import crypto from 'crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = config.encryption.key;
  return crypto.scryptSync(key, 'salt', 32);
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = getKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function generateApiKey(): string {
  return `ms_${crypto.randomBytes(32).toString('hex')}`;
}

export function generateSecurePassword(length: number = 24): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const charsetLength = charset.length;
  // Use rejection sampling to avoid modulo bias
  const maxValid = 256 - (256 % charsetLength);
  let password = '';
  while (password.length < length) {
    const randomBytes = crypto.randomBytes(length - password.length);
    for (let i = 0; i < randomBytes.length && password.length < length; i++) {
      if (randomBytes[i] < maxValid) {
        password += charset[randomBytes[i] % charsetLength];
      }
    }
  }
  return password;
}

export function getKeyPrefix(key: string): string {
  return key.substring(0, 11);
}
