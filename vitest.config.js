// vitest.config.js
import { defineConfig } from 'vitest/config';

// Get default test database URL using current user
const getDefaultTestUrl = () => {
  const username = process.env.USER || process.env.USERNAME || 'postgres';
  return `postgresql://${username}@localhost:5432/conductor_test`;
};

export default defineConfig({
  test: {
    threads: false,                 // run tests in a single thread
    sequence: { concurrent: false },// run files in order
    globalSetup: './setup.js', // Initialize database before all tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/rbac.test.js',              // Custom test file, not Vitest format
      '**/permission-service.test.js', // Custom test file, not Vitest format
      '**/rbac-permission.test.js',   // Custom test file, not Vitest format
    ],
    env: {
      // Set test environment variables if not already set
      NODE_ENV: process.env.NODE_ENV || 'test',
      VITEST: 'true',
      // Use TEST_DATABASE_URL if provided, otherwise use default test database
      DATABASE_URL: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || getDefaultTestUrl(),
    },
  },
});