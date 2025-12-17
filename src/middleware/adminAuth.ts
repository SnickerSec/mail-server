import { FastifyRequest, FastifyReply } from 'fastify';
import type { JWTPayload } from '../types/index.js';

export async function adminAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const decoded = await request.jwtVerify<JWTPayload>();

    if (decoded.type !== 'admin') {
      reply.status(403).send({ error: 'Admin access required' });
      return;
    }

    request.user = decoded;
  } catch (err) {
    reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
