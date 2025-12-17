import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    expiresIn: '24h',
  },

  encryption: {
    key: requireEnv('ENCRYPTION_KEY'),
  },

  admin: {
    email: optionalEnv('ADMIN_EMAIL', 'admin@localhost'),
    password: optionalEnv('ADMIN_PASSWORD', 'changeme'),
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(optionalEnv('SMTP_PORT', '587'), 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: process.env.SMTP_SECURE === 'true',
  },

  rateLimit: {
    max: parseInt(optionalEnv('RATE_LIMIT_MAX', '100'), 10),
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
  },
} as const;
