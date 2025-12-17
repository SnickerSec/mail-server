import { config } from '../config.js';

interface ErrorContext {
  userId?: string;
  domainId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

interface MonitoringEvent {
  type: 'error' | 'warning' | 'info';
  message: string;
  context?: ErrorContext;
  error?: Error;
  timestamp: string;
}

class MonitoringService {
  private sentryDsn: string | null;
  private enabled: boolean;

  constructor() {
    this.sentryDsn = process.env.SENTRY_DSN || null;
    this.enabled = config.isProduction && !!this.sentryDsn;
  }

  /**
   * Capture an error and send to monitoring service
   */
  captureError(error: Error, context?: ErrorContext): void {
    const event: MonitoringEvent = {
      type: 'error',
      message: error.message,
      context,
      error,
      timestamp: new Date().toISOString(),
    };

    this.logEvent(event);

    if (this.enabled && this.sentryDsn) {
      this.sendToSentry(event);
    }
  }

  /**
   * Capture a warning
   */
  captureWarning(message: string, context?: ErrorContext): void {
    const event: MonitoringEvent = {
      type: 'warning',
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    this.logEvent(event);
  }

  /**
   * Capture an informational event
   */
  captureInfo(message: string, context?: ErrorContext): void {
    const event: MonitoringEvent = {
      type: 'info',
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    if (!config.isProduction) {
      this.logEvent(event);
    }
  }

  /**
   * Log event to console in structured format
   */
  private logEvent(event: MonitoringEvent): void {
    const logData = {
      level: event.type,
      message: event.message,
      timestamp: event.timestamp,
      ...event.context,
      ...(event.error && !config.isProduction
        ? { stack: event.error.stack }
        : {}),
    };

    if (config.isProduction) {
      // JSON format for production log aggregation
      console.log(JSON.stringify(logData));
    } else {
      // Pretty print for development
      const prefix =
        event.type === 'error'
          ? '\x1b[31m[ERROR]\x1b[0m'
          : event.type === 'warning'
            ? '\x1b[33m[WARN]\x1b[0m'
            : '\x1b[34m[INFO]\x1b[0m';
      console.log(`${prefix} ${event.message}`, event.context || '');
      if (event.error?.stack && !config.isProduction) {
        console.log(event.error.stack);
      }
    }
  }

  /**
   * Send event to Sentry
   * Note: For full Sentry integration, install @sentry/node package
   */
  private async sendToSentry(event: MonitoringEvent): Promise<void> {
    if (!this.sentryDsn) return;

    try {
      // Basic Sentry API envelope format
      // For production use, consider using @sentry/node SDK
      const payload = {
        event_id: this.generateEventId(),
        timestamp: event.timestamp,
        level: event.type,
        message: event.message,
        extra: event.context,
        exception: event.error
          ? {
              values: [
                {
                  type: event.error.name,
                  value: event.error.message,
                  stacktrace: {
                    frames: this.parseStackTrace(event.error.stack),
                  },
                },
              ],
            }
          : undefined,
      };

      const response = await fetch(`${this.getSentryEndpoint()}/store/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': this.buildSentryAuth(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('Failed to send to Sentry:', response.status);
      }
    } catch (err) {
      console.error('Error sending to Sentry:', err);
    }
  }

  private generateEventId(): string {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private getSentryEndpoint(): string {
    if (!this.sentryDsn) return '';
    const url = new URL(this.sentryDsn);
    return `${url.protocol}//${url.host}/api${url.pathname}`;
  }

  private buildSentryAuth(): string {
    if (!this.sentryDsn) return '';
    const url = new URL(this.sentryDsn);
    const publicKey = url.username;
    return `Sentry sentry_version=7, sentry_key=${publicKey}`;
  }

  private parseStackTrace(
    stack?: string
  ): Array<{ filename: string; lineno: number; function: string }> {
    if (!stack) return [];

    return stack
      .split('\n')
      .slice(1)
      .map((line) => {
        const match = line.match(/at (.+) \((.+):(\d+):\d+\)/);
        if (match) {
          return {
            function: match[1],
            filename: match[2],
            lineno: parseInt(match[3], 10),
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{
      filename: string;
      lineno: number;
      function: string;
    }>;
  }

  /**
   * Track a metric (for observability)
   */
  trackMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    if (config.isProduction) {
      console.log(
        JSON.stringify({
          type: 'metric',
          name,
          value,
          tags,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

// Convenience exports
export const captureError = monitoring.captureError.bind(monitoring);
export const captureWarning = monitoring.captureWarning.bind(monitoring);
export const captureInfo = monitoring.captureInfo.bind(monitoring);
export const trackMetric = monitoring.trackMetric.bind(monitoring);
