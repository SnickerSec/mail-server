import { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { prisma } from '../lib/prisma.js';
import { logsQuerySchema } from '../schemas/index.js';
import type { LogsQuery } from '../types/index.js';

export async function logRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', adminAuth);

  fastify.get<{ Querystring: LogsQuery }>('/logs', async (request, reply) => {
    const validation = logsQuerySchema.safeParse(request.query);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { page, limit, domainId, status } = validation.data;
    const skip = (page - 1) * limit;

    const where: {
      domainId?: string;
      status?: string;
    } = {};

    if (domainId) {
      where.domainId = domainId;
    }

    if (status) {
      where.status = status;
    }

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: {
          domain: {
            select: { name: true },
          },
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    return reply.send({
      logs: logs.map((log) => ({
        id: log.id,
        domainId: log.domainId,
        domainName: log.domain.name,
        messageId: log.messageId,
        fromEmail: log.fromEmail,
        toEmail: log.toEmail,
        subject: log.subject,
        status: log.status,
        error: log.error,
        sentAt: log.sentAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  fastify.get('/logs/stats', async (request, reply) => {
    const [total, sent, failed, recentActivity] = await Promise.all([
      prisma.emailLog.count(),
      prisma.emailLog.count({ where: { status: 'sent' } }),
      prisma.emailLog.count({ where: { status: 'failed' } }),
      prisma.emailLog.groupBy({
        by: ['status'],
        where: {
          sentAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        _count: true,
      }),
    ]);

    const last24h = {
      sent: recentActivity.find((r) => r.status === 'sent')?._count || 0,
      failed: recentActivity.find((r) => r.status === 'failed')?._count || 0,
    };

    return reply.send({
      stats: {
        total,
        sent,
        failed,
        successRate: total > 0 ? ((sent / total) * 100).toFixed(2) : '0',
        last24h,
      },
    });
  });
}
