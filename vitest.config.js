// vitest.config.js
import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

// Load environment variables from .env file
loadEnv();

// Get default test database URL using current user
const getDefaultTestUrl = () => {
  const username = process.env.USER || process.env.USERNAME || 'postgres';
  return `postgresql://${username}@localhost:5432/conductor_test`;
};

export default defineConfig({
  test: {
    environment: 'node',            // Use Node.js environment for server-side testing
    pool: 'forks',                  // Use separate processes for better isolation
    poolOptions: {
      forks: {
        singleFork: true,           // Run all tests in a single fork sequentially
      },
    },
    fileParallelism: false,         // Don't run test files in parallel
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
      '**/permission-service.test.js', // Custom test with complex pool mocking, run separately
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