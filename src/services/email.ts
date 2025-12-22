import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import BrevoTransport from 'nodemailer-brevo-transport';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { decrypt } from '../lib/crypto.js';
import type { SendEmailBody } from '../types/index.js';

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  willRetry?: boolean;
  retryCount?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [60000, 300000, 900000]; // 1 min, 5 min, 15 min

function calculateNextRetry(retryCount: number): Date | null {
  if (retryCount >= MAX_RETRIES) {
    return null;
  }
  const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
  return new Date(Date.now() + delay);
}

function isRetryableError(error: string): boolean {
  const retryablePatterns = [
    /connection refused/i,
    /timeout/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /temporary.*failure/i,
    /try again/i,
    /service unavailable/i,
    /too many connections/i,
    /rate limit/i,
  ];
  return retryablePatterns.some((pattern) => pattern.test(error));
}

function createTransport(dkimOptions?: {
  domainName: string;
  keySelector: string;
  privateKey: string;
}): Transporter {
  // Use Brevo HTTP API if API key is configured (bypasses SMTP port restrictions)
  if (config.brevo.apiKey) {
    return nodemailer.createTransport(
      new BrevoTransport({ apiKey: config.brevo.apiKey })
    );
  }

  const transportOptions: nodemailer.TransportOptions & {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
    dkim?: {
      domainName: string;
      keySelector: string;
      privateKey: string;
    };
  } = {};

  if (config.smtp.host) {
    transportOptions.host = config.smtp.host;
    transportOptions.port = config.smtp.port;
    transportOptions.secure = config.smtp.secure;

    if (config.smtp.user && config.smtp.pass) {
      transportOptions.auth = {
        user: config.smtp.user,
        pass: config.smtp.pass,
      };
    }
  } else {
    (transportOptions as any).sendmail = true;
    (transportOptions as any).newline = 'unix';
    (transportOptions as any).path = '/usr/sbin/sendmail';
  }

  if (dkimOptions) {
    transportOptions.dkim = dkimOptions;
  }

  return nodemailer.createTransport(transportOptions as any);
}

export async function sendEmail(
  domainId: string,
  emailData: SendEmailBody
): Promise<SendResult> {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
  });

  if (!domain) {
    return { success: false, error: 'Domain not found' };
  }

  if (!domain.isActive) {
    return { success: false, error: 'Domain is not active' };
  }

  const fromDomain = emailData.from.split('@')[1];
  if (fromDomain !== domain.name) {
    return {
      success: false,
      error: `From address must use domain ${domain.name}`,
    };
  }

  let privateKey: string;
  try {
    privateKey = decrypt(domain.dkimPrivateKey);
  } catch (err) {
    return { success: false, error: 'Failed to decrypt DKIM key' };
  }

  const transporter = createTransport({
    domainName: domain.name,
    keySelector: domain.dkimSelector,
    privateKey,
  });

  const toAddresses = Array.isArray(emailData.to)
    ? emailData.to
    : [emailData.to];

  try {
    const info = await transporter.sendMail({
      from: emailData.from,
      to: toAddresses.join(', '),
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || (emailData.html ? undefined : ''),
      replyTo: emailData.replyTo,
    });

    await prisma.emailLog.create({
      data: {
        domainId,
        messageId: info.messageId,
        fromEmail: emailData.from,
        toEmail: toAddresses.join(', '),
        subject: emailData.subject,
        status: 'sent',
        retryCount: 0,
      },
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    const shouldRetry = isRetryableError(error);
    const nextRetryAt = shouldRetry ? calculateNextRetry(0) : null;

    await prisma.emailLog.create({
      data: {
        domainId,
        fromEmail: emailData.from,
        toEmail: toAddresses.join(', '),
        subject: emailData.subject,
        status: shouldRetry ? 'pending_retry' : 'failed',
        error,
        retryCount: 0,
        nextRetryAt,
      },
    });

    return {
      success: false,
      error,
      willRetry: shouldRetry,
      retryCount: 0,
    };
  }
}

/**
 * Process pending email retries
 * Should be called periodically (e.g., every minute via cron or setInterval)
 */
export async function processEmailRetries(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const pendingRetries = await prisma.emailLog.findMany({
    where: {
      status: 'pending_retry',
      nextRetryAt: {
        lte: new Date(),
      },
    },
    include: {
      domain: true,
    },
    take: 10, // Process in batches
  });

  let succeeded = 0;
  let failed = 0;

  for (const log of pendingRetries) {
    const domain = log.domain;

    if (!domain.isActive) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          error: 'Domain is no longer active',
          nextRetryAt: null,
        },
      });
      failed++;
      continue;
    }

    let privateKey: string;
    try {
      privateKey = decrypt(domain.dkimPrivateKey);
    } catch {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          error: 'Failed to decrypt DKIM key',
          nextRetryAt: null,
        },
      });
      failed++;
      continue;
    }

    const transporter = createTransport({
      domainName: domain.name,
      keySelector: domain.dkimSelector,
      privateKey,
    });

    try {
      const info = await transporter.sendMail({
        from: log.fromEmail,
        to: log.toEmail,
        subject: log.subject,
      });

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          messageId: info.messageId,
          error: null,
          nextRetryAt: null,
        },
      });
      succeeded++;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      const newRetryCount = log.retryCount + 1;
      const shouldRetry = isRetryableError(error) && newRetryCount < MAX_RETRIES;
      const nextRetryAt = shouldRetry ? calculateNextRetry(newRetryCount) : null;

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: shouldRetry ? 'pending_retry' : 'failed',
          error,
          retryCount: newRetryCount,
          nextRetryAt,
        },
      });
      failed++;
    }
  }

  return { processed: pendingRetries.length, succeeded, failed };
}
