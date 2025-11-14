// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    threads: false,                 // run tests in a single thread
    sequence: { concurrent: false },// run files in order
    env: {
      // Set test environment variables if not already set
      NODE_ENV: process.env.NODE_ENV || 'test',
      VITEST: 'true',
      // Use TEST_DATABASE_URL if provided, otherwise use default test database
      DATABASE_URL: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/conductor_test',
    },
  },
});