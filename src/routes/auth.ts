import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { loginSchema } from '../schemas/index.js';
import type { LoginBody, JWTPayload } from '../types/index.js';

const BCRYPT_ROUNDS = 12;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: LoginBody }>('/auth/login', async (request, reply) => {
    const validation = loginSchema.safeParse(request.body);

    if (!validation.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { email, password } = validation.data;

    const user = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      type: 'admin',
    };

    const token = fastify.jwt.sign(payload);

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
      requirePasswordChange: user.requirePasswordChange,
    });
  });

  fastify.get('/auth/me', {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const user = request.user as JWTPayload;

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, createdAt: true, requirePasswordChange: true },
    });

    if (!adminUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send({ user: adminUser });
  });

  fastify.post<{ Body: { currentPassword: string; newPassword: string } }>(
    '/auth/change-password',
    {
      preHandler: async (request, reply) => {
        try {
          await request.jwtVerify();
        } catch (err) {
          reply.status(401).send({ error: 'Unauthorized' });
        }
      },
    },
    async (request, reply) => {
      const validation = changePasswordSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        });
      }

      const { currentPassword, newPassword } = validation.data;
      const jwtUser = request.user as JWTPayload;

      const user = await prisma.adminUser.findUnique({
        where: { id: jwtUser.sub },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

      if (!isValid) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          requirePasswordChange: false,
        },
      });

      return reply.send({ message: 'Password changed successfully' });
    }
  );
}
