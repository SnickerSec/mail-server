import { FastifyRequest } from 'fastify';

export interface SendEmailBody {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export interface CreateDomainBody {
  name: string;
}

export interface CreateApiKeyBody {
  name: string;
  expiresIn?: '30d' | '90d' | '180d' | '365d' | 'never';
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  type: 'admin';
}

export interface ApiKeyPayload {
  domainId: string;
  domainName: string;
  keyId: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload;
}

export interface ApiKeyAuthenticatedRequest extends FastifyRequest {
  apiKey: ApiKeyPayload;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface LogsQuery extends PaginationQuery {
  domainId?: string;
  status?: string;
}

export interface DnsRecord {
  type: string;
  host: string;
  value: string;
  ttl: number;
}
