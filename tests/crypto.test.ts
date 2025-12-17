import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, generateApiKey, getKeyPrefix, generateSecurePassword } from '../src/lib/crypto.js';

describe('Crypto Module', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const originalText = 'Hello, World!';
      const encrypted = encrypt(originalText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(originalText);
    });

    it('should produce different ciphertexts for same input (random IV)', () => {
      const text = 'Same text';
      const encrypted1 = encrypt(text);
      const encrypted2 = encrypt(text);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle special characters', () => {
      const specialText = '🔐 Special chars: <>&"\'\\n\\t';
      const encrypted = encrypt(specialText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(specialText);
    });

    it('should handle long text', () => {
      const longText = 'A'.repeat(10000);
      const encrypted = encrypt(longText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(longText);
    });

    it('encrypted format should contain IV, authTag, and ciphertext', () => {
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // IV is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32); // Auth tag is 16 bytes = 32 hex chars
    });
  });

  describe('generateApiKey', () => {
    it('should generate a key with ms_ prefix', () => {
      const key = generateApiKey();

      expect(key).toMatch(/^ms_[a-f0-9]{64}$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('getKeyPrefix', () => {
    it('should return first 11 characters', () => {
      const key = 'ms_1234567890abcdef';
      const prefix = getKeyPrefix(key);

      expect(prefix).toBe('ms_12345678');
      expect(prefix).toHaveLength(11);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password of specified length', () => {
      const password = generateSecurePassword(16);

      expect(password).toHaveLength(16);
    });

    it('should default to 24 characters', () => {
      const password = generateSecurePassword();

      expect(password).toHaveLength(24);
    });

    it('should generate unique passwords', () => {
      const passwords = new Set();
      for (let i = 0; i < 100; i++) {
        passwords.add(generateSecurePassword());
      }

      expect(passwords.size).toBe(100);
    });

    it('should only contain allowed characters', () => {
      const password = generateSecurePassword(100);
      const allowedChars = /^[a-zA-Z0-9!@#$%^&*]+$/;

      expect(password).toMatch(allowedChars);
    });
  });
});
