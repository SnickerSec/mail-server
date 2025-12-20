import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { getKeyPrefix } from '../lib/crypto.js';

export async function apiKeyAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply | void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({ error: 'Missing Authorization header' });
  }

  const [scheme, key] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !key) {
    return reply.status(401).send({ error: 'Invalid Authorization format. Use: Bearer <api_key>' });
  }

  const keyPrefix = getKeyPrefix(key);

  const apiKeys = await prisma.apiKey.findMany({
    where: {
      keyPrefix,
      isActive: true,
    },
    include: {
      domain: true,
    },
  });

  for (const apiKey of apiKeys) {
    const isValid = await bcrypt.compare(key, apiKey.keyHash);

    if (isValid) {
      // Check if key has expired
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return reply.status(401).send({ error: 'API key has expired' });
      }

      if (!apiKey.domain.isActive) {
        return reply.status(403).send({ error: 'Domain is not active' });
      }

      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });

      request.apiKey = {
        domainId: apiKey.domainId,
        domainName: apiKey.domain.name,
        keyId: apiKey.id,
      };

      return;
    }
  }

  return reply.status(401).send({ error: 'Invalid API key' });
}
