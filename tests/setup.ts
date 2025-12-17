// Test setup file
import { beforeAll, afterAll } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-xx';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

beforeAll(() => {
  // Setup code that runs before all tests
});

afterAll(() => {
  // Cleanup code that runs after all tests
});
