import { describe, it, expect } from 'vitest';
import {
  sendEmailSchema,
  createDomainSchema,
  createApiKeySchema,
  loginSchema,
  paginationSchema,
} from '../src/schemas/index.js';

describe('Schema Validation', () => {
  describe('sendEmailSchema', () => {
    it('should validate correct email data', () => {
      const result = sendEmailSchema.safeParse({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });

      expect(result.success).toBe(true);
    });

    it('should accept array of recipients', () => {
      const result = sendEmailSchema.safeParse({
        from: 'sender@example.com',
        to: ['one@example.com', 'two@example.com'],
        subject: 'Test',
        text: 'Hello',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid from email', () => {
      const result = sendEmailSchema.safeParse({
        from: 'not-an-email',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });

      expect(result.success).toBe(false);
    });

    it('should require either html or text', () => {
      const result = sendEmailSchema.safeParse({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty subject', () => {
      const result = sendEmailSchema.safeParse({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: '',
        html: '<p>Hi</p>',
      });

      expect(result.success).toBe(false);
    });

    it('should accept optional replyTo', () => {
      const result = sendEmailSchema.safeParse({
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hi</p>',
        replyTo: 'reply@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should reject more than 50 recipients', () => {
      const recipients = Array(51).fill('test@example.com');
      const result = sendEmailSchema.safeParse({
        from: 'sender@example.com',
        to: recipients,
        subject: 'Test',
        html: '<p>Hi</p>',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('createDomainSchema', () => {
    it('should validate correct domain name', () => {
      const result = createDomainSchema.safeParse({ name: 'example.com' });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('example.com');
    });

    it('should lowercase domain names', () => {
      const result = createDomainSchema.safeParse({ name: 'EXAMPLE.COM' });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('example.com');
    });

    it('should accept subdomains', () => {
      const result = createDomainSchema.safeParse({ name: 'mail.example.com' });

      expect(result.success).toBe(true);
    });

    it('should reject invalid domain format', () => {
      const invalidDomains = [
        'example',
        'example.',
        '.example.com',
        'example..com',
        '-example.com',
        'example-.com',
      ];

      for (const domain of invalidDomains) {
        const result = createDomainSchema.safeParse({ name: domain });
        expect(result.success).toBe(false);
      }
    });

    it('should reject empty domain', () => {
      const result = createDomainSchema.safeParse({ name: '' });

      expect(result.success).toBe(false);
    });
  });

  describe('createApiKeySchema', () => {
    it('should validate correct API key data', () => {
      const result = createApiKeySchema.safeParse({ name: 'My API Key' });

      expect(result.success).toBe(true);
    });

    it('should default expiresIn to never', () => {
      const result = createApiKeySchema.safeParse({ name: 'Test Key' });

      expect(result.success).toBe(true);
      expect(result.data?.expiresIn).toBe('never');
    });

    it('should accept valid expiration options', () => {
      const options = ['30d', '90d', '180d', '365d', 'never'];

      for (const expiresIn of options) {
        const result = createApiKeySchema.safeParse({ name: 'Test', expiresIn });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid expiration options', () => {
      const result = createApiKeySchema.safeParse({ name: 'Test', expiresIn: '7d' });

      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = createApiKeySchema.safeParse({ name: '' });

      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 chars', () => {
      const result = createApiKeySchema.safeParse({ name: 'A'.repeat(101) });

      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const result = loginSchema.safeParse({
        email: 'admin@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'admin@example.com',
        password: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should provide defaults', () => {
      const result = paginationSchema.safeParse({});

      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(1);
      expect(result.data?.limit).toBe(20);
    });

    it('should parse string numbers', () => {
      const result = paginationSchema.safeParse({ page: '2', limit: '50' });

      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(2);
      expect(result.data?.limit).toBe(50);
    });

    it('should reject page less than 1', () => {
      const result = paginationSchema.safeParse({ page: '0' });

      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const result = paginationSchema.safeParse({ limit: '101' });

      expect(result.success).toBe(false);
    });
  });
});
