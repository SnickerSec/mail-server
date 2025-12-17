import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { adminAuth } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { generateApiKey, getKeyPrefix } from '../lib/crypto.js';
import { createApiKeySchema } from '../schemas/index.js';
import type { CreateApiKeyBody } from '../types/index.js';

const BCRYPT_ROUNDS = 12;

function calculateExpiresAt(expiresIn: string): Date | null {
  if (expiresIn === 'never') {
    return null;
  }
  const days = parseInt(expiresIn.replace('d', ''), 10);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  return expiresAt;
}

export async function keyRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', adminAuth);

  fastify.get<{ Params: { domainId: string } }>(
    '/domains/:domainId/keys',
    async (request, reply) => {
      const { domainId } = request.params;

      const domain = await prisma.domain.findUnique({
        where: { id: domainId },
      });

      if (!domain) {
        return reply.status(404).send({ error: 'Domain not found' });
      }

      const keys = await prisma.apiKey.findMany({
        where: { domainId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          isActive: true,
          expiresAt: true,
          lastUsedAt: true,
          createdAt: true,
        },
      });

      // Add computed expired status
      const keysWithStatus = keys.map((key) => ({
        ...key,
        isExpired: key.expiresAt ? key.expiresAt < new Date() : false,
      }));

      return reply.send({ keys: keysWithStatus });
    }
  );

  fastify.post<{ Params: { domainId: string }; Body: CreateApiKeyBody }>(
    '/domains/:domainId/keys',
    async (request, reply) => {
      const { domainId } = request.params;

      const validation = createApiKeySchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        });
      }

      const domain = await prisma.domain.findUnique({
        where: { id: domainId },
      });

      if (!domain) {
        return reply.status(404).send({ error: 'Domain not found' });
      }

      const { name, expiresIn } = validation.data;
      const rawKey = generateApiKey();
      const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);
      const keyPrefix = getKeyPrefix(rawKey);
      const expiresAt = calculateExpiresAt(expiresIn);

      const apiKey = await prisma.apiKey.create({
        data: {
          name,
          keyHash,
          keyPrefix,
          domainId,
          expiresAt,
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      return reply.status(201).send({
        key: {
          ...apiKey,
          rawKey, // Only returned once, at creation time
        },
        warning: 'Save this API key now. It will not be shown again.',
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      });
    }
  );

  fastify.patch<{ Params: { id: string }; Body: { isActive?: boolean } }>(
    '/keys/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { isActive } = request.body;

      const apiKey = await prisma.apiKey.findUnique({ where: { id } });

      if (!apiKey) {
        return reply.status(404).send({ error: 'API key not found' });
      }

      const updated = await prisma.apiKey.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          isActive: true,
          expiresAt: true,
          lastUsedAt: true,
          createdAt: true,
        },
      });

      return reply.send({
        key: {
          ...updated,
          isExpired: updated.expiresAt ? updated.expiresAt < new Date() : false,
        },
      });
    }
  );

  fastify.delete<{ Params: { id: string } }>('/keys/:id', async (request, reply) => {
    const { id } = request.params;

    const apiKey = await prisma.apiKey.findUnique({ where: { id } });

    if (!apiKey) {
      return reply.status(404).send({ error: 'API key not found' });
    }

    await prisma.apiKey.delete({ where: { id } });

    return reply.status(204).send();
  });

  // Rotate an API key - generates a new key with same settings
  fastify.post<{ Params: { id: string }; Body: { expiresIn?: string } }>(
    '/keys/:id/rotate',
    async (request, reply) => {
      const { id } = request.params;
      const { expiresIn } = request.body || {};

      const existingKey = await prisma.apiKey.findUnique({
        where: { id },
        include: { domain: true },
      });

      if (!existingKey) {
        return reply.status(404).send({ error: 'API key not found' });
      }

      // Generate new key
      const rawKey = generateApiKey();
      const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);
      const keyPrefix = getKeyPrefix(rawKey);

      // Calculate new expiration if provided, otherwise keep existing or set to 90 days
      let newExpiresAt: Date | null;
      if (expiresIn) {
        newExpiresAt = calculateExpiresAt(expiresIn);
      } else if (existingKey.expiresAt) {
        // Extend by same duration from now
        const originalDuration = existingKey.expiresAt.getTime() - existingKey.createdAt.getTime();
        newExpiresAt = new Date(Date.now() + originalDuration);
      } else {
        newExpiresAt = null; // No expiration
      }

      // Update the key
      const updatedKey = await prisma.apiKey.update({
        where: { id },
        data: {
          keyHash,
          keyPrefix,
          expiresAt: newExpiresAt,
          lastUsedAt: null, // Reset last used
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      return reply.send({
        key: {
          ...updatedKey,
          rawKey, // Only returned once, at rotation time
        },
        warning: 'Save this new API key now. It will not be shown again. The old key is now invalid.',
        expiresAt: newExpiresAt ? newExpiresAt.toISOString() : null,
      });
    }
  );
}
