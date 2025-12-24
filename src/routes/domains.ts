import { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { encrypt } from '../lib/crypto.js';
import { generateDkimKeyPair, getDnsRecords } from '../services/dkim.js';
import { verifyDomainDns } from '../services/dnsVerification.js';
import { createDomainSchema, paginationSchema } from '../schemas/index.js';
import { config } from '../config.js';
import type { CreateDomainBody, PaginationQuery } from '../types/index.js';

export async function domainRoutes(fastify: FastifyInstance): Promise<void> {
  // Rate limiting is applied globally in server.ts, this adds route-level config
  fastify.addHook('preHandler', adminAuth);
  const routeRateLimit = { max: config.rateLimit.max, timeWindow: config.rateLimit.windowMs };

  fastify.get<{ Querystring: PaginationQuery }>('/domains', { config: { rateLimit: routeRateLimit } }, async (request, reply) => {
    const { page, limit } = paginationSchema.parse(request.query);
    const skip = (page - 1) * limit;

    const [domains, total] = await Promise.all([
      prisma.domain.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          dkimSelector: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              apiKeys: { where: { isActive: true } },
              emailLogs: true,
            },
          },
        },
      }),
      prisma.domain.count(),
    ]);

    return reply.send({
      domains: domains.map((d) => ({
        ...d,
        apiKeyCount: d._count.apiKeys,
        emailCount: d._count.emailLogs,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  fastify.post<{ Body: CreateDomainBody }>('/domains', { config: { rateLimit: routeRateLimit } }, async (request, reply) => {
    const validation = createDomainSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { name } = validation.data;

    const existing = await prisma.domain.findUnique({
      where: { name },
    });

    if (existing) {
      return reply.status(409).send({ error: 'Domain already exists' });
    }

    const { privateKey, publicKey } = generateDkimKeyPair();
    const encryptedPrivateKey = encrypt(privateKey);

    const domain = await prisma.domain.create({
      data: {
        name,
        dkimPrivateKey: encryptedPrivateKey,
        dkimPublicKey: publicKey,
      },
    });

    const dnsRecords = getDnsRecords(domain.name, domain.dkimSelector, publicKey);

    return reply.status(201).send({
      domain: {
        id: domain.id,
        name: domain.name,
        dkimSelector: domain.dkimSelector,
        isVerified: domain.isVerified,
        isActive: domain.isActive,
        createdAt: domain.createdAt,
      },
      dnsRecords,
    });
  });

  fastify.get<{ Params: { id: string } }>('/domains/:id', { config: { rateLimit: routeRateLimit } }, async (request, reply) => {
    const { id } = request.params;

    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            apiKeys: { where: { isActive: true } },
            emailLogs: true,
          },
        },
      },
    });

    if (!domain) {
      return reply.status(404).send({ error: 'Domain not found' });
    }

    const dnsRecords = getDnsRecords(
      domain.name,
      domain.dkimSelector,
      domain.dkimPublicKey
    );

    return reply.send({
      domain: {
        id: domain.id,
        name: domain.name,
        dkimSelector: domain.dkimSelector,
        isVerified: domain.isVerified,
        isActive: domain.isActive,
        createdAt: domain.createdAt,
        apiKeyCount: domain._count.apiKeys,
        emailCount: domain._count.emailLogs,
      },
      dnsRecords,
    });
  });

  fastify.patch<{ Params: { id: string }; Body: { isActive?: boolean } }>(
    '/domains/:id',
    { config: { rateLimit: routeRateLimit } },
    async (request, reply) => {
      const { id } = request.params;
      const { isActive } = request.body;

      const domain = await prisma.domain.findUnique({ where: { id } });

      if (!domain) {
        return reply.status(404).send({ error: 'Domain not found' });
      }

      const updated = await prisma.domain.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          name: true,
          dkimSelector: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
        },
      });

      return reply.send({ domain: updated });
    }
  );

  fastify.delete<{ Params: { id: string } }>('/domains/:id', { config: { rateLimit: routeRateLimit } }, async (request, reply) => {
    const { id } = request.params;

    const domain = await prisma.domain.findUnique({ where: { id } });

    if (!domain) {
      return reply.status(404).send({ error: 'Domain not found' });
    }

    await prisma.domain.delete({ where: { id } });

    return reply.status(204).send();
  });

  fastify.post<{ Params: { id: string } }>(
    '/domains/:id/verify',
    { config: { rateLimit: routeRateLimit } },
    async (request, reply) => {
      const { id } = request.params;

      const domain = await prisma.domain.findUnique({ where: { id } });

      if (!domain) {
        return reply.status(404).send({ error: 'Domain not found' });
      }

      // Actually verify DNS records
      const verification = await verifyDomainDns(
        domain.name,
        domain.dkimSelector,
        domain.dkimPublicKey
      );

      // Update verification status based on actual DNS check
      const updated = await prisma.domain.update({
        where: { id },
        data: { isVerified: verification.allValid },
        select: {
          id: true,
          name: true,
          isVerified: true,
        },
      });

      return reply.send({
        domain: updated,
        verification: {
          spf: {
            valid: verification.spf.valid,
            found: verification.spf.found,
            required: 'TXT record starting with "v=spf1"',
          },
          dkim: {
            valid: verification.dkim.valid,
            found: verification.dkim.found,
            required: `TXT record at ${domain.dkimSelector}._domainkey.${domain.name}`,
          },
          dmarc: {
            valid: verification.dmarc.valid,
            found: verification.dmarc.found,
            required: 'TXT record at _dmarc.' + domain.name,
          },
        },
        message: verification.allValid
          ? 'All DNS records verified successfully!'
          : 'Some DNS records are missing or incorrect. Please check the verification details.',
      });
    }
  );
}
