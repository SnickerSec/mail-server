import bcrypt from 'bcrypt';
import { buildServer } from './server.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';
import { generateSecurePassword } from './lib/crypto.js';
import { processEmailRetries } from './services/email.js';

let retryIntervalId: ReturnType<typeof setInterval> | null = null;

function startEmailRetryProcessor(): void {
  // Process retries every 60 seconds
  retryIntervalId = setInterval(async () => {
    try {
      const result = await processEmailRetries();
      if (result.processed > 0) {
        console.log(
          `Email retry processor: processed=${result.processed}, succeeded=${result.succeeded}, failed=${result.failed}`
        );
      }
    } catch (err) {
      console.error('Email retry processor error:', err);
    }
  }, 60000);

  console.log('Email retry processor started (60s interval)');
}

function stopEmailRetryProcessor(): void {
  if (retryIntervalId) {
    clearInterval(retryIntervalId);
    retryIntervalId = null;
    console.log('Email retry processor stopped');
  }
}

async function ensureAdminUser(): Promise<void> {
  const existingAdmin = await prisma.adminUser.findFirst();

  if (!existingAdmin) {
    console.log('Creating initial admin user...');

    // If using default password, generate a secure random one
    let password = config.admin.password;
    const isDefaultPassword = password === 'changeme';

    if (isDefaultPassword) {
      password = generateSecurePassword(24);
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║                    INITIAL ADMIN CREDENTIALS                    ║');
      console.log('╠════════════════════════════════════════════════════════════════╣');
      console.log(`║  Email:    ${config.admin.email.padEnd(51)}║`);
      console.log(`║  Password: ${password.padEnd(51)}║`);
      console.log('╠════════════════════════════════════════════════════════════════╣');
      console.log('║  ⚠️  SAVE THIS PASSWORD NOW - IT WILL NOT BE SHOWN AGAIN!      ║');
      console.log('║  You will be required to change it on first login.             ║');
      console.log('╚════════════════════════════════════════════════════════════════╝');
      console.log('');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.adminUser.create({
      data: {
        email: config.admin.email,
        passwordHash,
        requirePasswordChange: isDefaultPassword,
      },
    });

    console.log(`Admin user created: ${config.admin.email}`);
    if (!isDefaultPassword) {
      console.log('Using password from ADMIN_PASSWORD environment variable.');
    }
  }
}

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('Database connected');

    await ensureAdminUser();

    const server = await buildServer();

    await server.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    console.log(`Server running on http://0.0.0.0:${config.port}`);

    // Start background email retry processor
    startEmailRetryProcessor();

    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      stopEmailRetryProcessor();
      await server.close();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
