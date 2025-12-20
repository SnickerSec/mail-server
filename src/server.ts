import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { sendRoutes } from './routes/send.js';
import { authRoutes } from './routes/auth.js';
import { domainRoutes } from './routes/domains.js';
import { keyRoutes } from './routes/keys.js';
import { logRoutes } from './routes/logs.js';
import { captureError, trackMetric } from './services/monitoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.isProduction ? 'info' : 'debug',
      transport: config.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true },
          },
    },
  });

  await fastify.register(cors, {
    origin: config.isProduction ? false : true,
    credentials: true,
  });

  await fastify.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn,
    },
  });

  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    keyGenerator: (request) => {
      const authHeader = request.headers.authorization;
      if (authHeader) {
        return authHeader;
      }
      return request.ip;
    },
  });

  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await fastify.register(sendRoutes, { prefix: '/api/v1' });
  await fastify.register(authRoutes, { prefix: '/api/v1' });
  await fastify.register(domainRoutes, { prefix: '/api/v1' });
  await fastify.register(keyRoutes, { prefix: '/api/v1' });
  await fastify.register(logRoutes, { prefix: '/api/v1' });

  const publicPath = path.join(__dirname, '..', 'public');

  try {
    await fastify.register(fastifyStatic, {
      root: publicPath,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback - serve index.html for all non-API routes
    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html', publicPath);
    });
  } catch (err) {
    fastify.log.warn('Public directory not found, dashboard will not be served');

    fastify.setNotFoundHandler(async (request, reply) => {
      return reply.status(404).send({ error: 'Not found' });
    });
  }

  // Request timing and metrics
  fastify.addHook('onRequest', async (request) => {
    (request as any).startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - ((request as any).startTime || Date.now());
    trackMetric('http_request_duration_ms', duration, {
      method: request.method,
      route: request.routeOptions?.url || request.url,
      status: reply.statusCode.toString(),
    });
  });

  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    fastify.log.error(error);

    // Capture error for monitoring (5xx errors only)
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      captureError(error, {
        action: `${request.method} ${request.url}`,
        metadata: {
          statusCode,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
        },
      });
    }

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
      });
    }

    const message = config.isProduction
      ? 'Internal server error'
      : error.message;

    return reply.status(statusCode).send({
      error: message,
      ...(config.isProduction ? {} : { stack: error.stack }),
    });
  });

  return fastify;
}
