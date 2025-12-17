import { z } from 'zod';

export const sendEmailSchema = z.object({
  from: z.string().email('Invalid from email address'),
  to: z.union([
    z.string().email('Invalid to email address'),
    z.array(z.string().email('Invalid email in to array')).min(1).max(50),
  ]),
  subject: z.string().min(1, 'Subject is required').max(998, 'Subject too long'),
  html: z.string().max(10_000_000).optional(),
  text: z.string().max(10_000_000).optional(),
  replyTo: z.string().email('Invalid replyTo email').optional(),
}).refine(
  (data) => data.html || data.text,
  { message: 'Either html or text content is required' }
);

export const createDomainSchema = z.object({
  name: z
    .string()
    .min(1, 'Domain name is required')
    .max(253, 'Domain name too long')
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      'Invalid domain name format'
    )
    .transform((val) => val.toLowerCase()),
});

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'API key name is required')
    .max(100, 'API key name too long'),
  expiresIn: z
    .enum(['30d', '90d', '180d', '365d', 'never'])
    .optional()
    .default('never'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const logsQuerySchema = paginationSchema.extend({
  domainId: z.string().optional(),
  status: z.enum(['sent', 'failed']).optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type LogsQueryInput = z.infer<typeof logsQuerySchema>;
