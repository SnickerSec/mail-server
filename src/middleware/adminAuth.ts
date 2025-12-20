import { FastifyRequest, FastifyReply } from 'fastify';
import type { JWTPayload } from '../types/index.js';

export async function adminAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply | void> {
  try {
    const decoded = await request.jwtVerify<JWTPayload>();

    if (decoded.type !== 'admin') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
