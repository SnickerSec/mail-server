import { JWTPayload, ApiKeyPayload } from './index.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
    apiKey?: ApiKeyPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}
