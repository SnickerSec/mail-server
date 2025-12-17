import { describe, it, expect } from 'vitest';
import {
  generateDkimKeyPair,
  formatDkimPublicKeyForDns,
  getDnsRecords,
} from '../src/services/dkim.js';

describe('DKIM Service', () => {
  describe('generateDkimKeyPair', () => {
    it('should generate a valid key pair', () => {
      const { privateKey, publicKey } = generateDkimKeyPair();

      expect(privateKey).toContain('-----BEGIN RSA PRIVATE KEY-----');
      expect(privateKey).toContain('-----END RSA PRIVATE KEY-----');
      expect(publicKey).toBeTruthy();
      expect(publicKey.length).toBeGreaterThan(100); // Base64 encoded public key
    });

    it('should generate unique key pairs', () => {
      const pair1 = generateDkimKeyPair();
      const pair2 = generateDkimKeyPair();

      expect(pair1.privateKey).not.toBe(pair2.privateKey);
      expect(pair1.publicKey).not.toBe(pair2.publicKey);
    });
  });

  describe('formatDkimPublicKeyForDns', () => {
    it('should format public key for DNS TXT record', () => {
      const publicKey = 'MIIBIjANBg...test';
      const formatted = formatDkimPublicKeyForDns(publicKey);

      expect(formatted).toBe('v=DKIM1; k=rsa; p=MIIBIjANBg...test');
    });
  });

  describe('getDnsRecords', () => {
    it('should return all required DNS records', () => {
      const domain = 'example.com';
      const selector = 'mail';
      const publicKey = 'testPublicKey123';

      const records = getDnsRecords(domain, selector, publicKey);

      expect(records).toHaveProperty('dkim');
      expect(records).toHaveProperty('spf');
      expect(records).toHaveProperty('dmarc');
    });

    it('should format DKIM record correctly', () => {
      const records = getDnsRecords('example.com', 'mail', 'testKey');

      expect(records.dkim.type).toBe('TXT');
      expect(records.dkim.host).toBe('mail._domainkey.example.com');
      expect(records.dkim.value).toContain('v=DKIM1');
      expect(records.dkim.value).toContain('k=rsa');
      expect(records.dkim.value).toContain('p=testKey');
      expect(records.dkim.ttl).toBe(3600);
    });

    it('should format SPF record correctly', () => {
      const records = getDnsRecords('example.com', 'mail', 'testKey');

      expect(records.spf.type).toBe('TXT');
      expect(records.spf.host).toBe('example.com');
      expect(records.spf.value).toBe('v=spf1 a mx ~all');
      expect(records.spf.ttl).toBe(3600);
    });

    it('should format DMARC record correctly', () => {
      const records = getDnsRecords('example.com', 'mail', 'testKey');

      expect(records.dmarc.type).toBe('TXT');
      expect(records.dmarc.host).toBe('_dmarc.example.com');
      expect(records.dmarc.value).toContain('v=DMARC1');
      expect(records.dmarc.value).toContain('p=quarantine');
      expect(records.dmarc.value).toContain('rua=mailto:dmarc@example.com');
      expect(records.dmarc.ttl).toBe(3600);
    });

    it('should handle subdomain correctly', () => {
      const records = getDnsRecords('mail.example.com', 'selector', 'key');

      expect(records.dkim.host).toBe('selector._domainkey.mail.example.com');
      expect(records.dmarc.host).toBe('_dmarc.mail.example.com');
    });
  });
});
