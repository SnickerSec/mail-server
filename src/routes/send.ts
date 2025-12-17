import { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { sendEmailSchema } from '../schemas/index.js';
import { sendEmail } from '../services/email.js';
import type { SendEmailBody } from '../types/index.js';

export async function sendRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: SendEmailBody }>(
    '/send',
    {
      preHandler: apiKeyAuth,
    },
    async (request, reply) => {
      const validation = sendEmailSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        });
      }

      const { apiKey } = request;
      if (!apiKey) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const result = await sendEmail(apiKey.domainId, validation.data);

      if (!result.success) {
        return reply.status(400).send({
          error: 'Failed to send email',
          details: result.error,
        });
      }

      return reply.status(200).send({
        success: true,
        messageId: result.messageId,
      });
    }
  );
}
