// scripts/run-tests.js
import fs from 'fs';
import { execSync } from 'child_process';

const testFiles = fs
  .readdirSync('src/tests')
  .filter(f => f.endsWith('.test.js'))
  .map(f => `src/tests/${f}`);

// Get default test database URL using current user
const getDefaultTestUrl = () => {
  const username = process.env.USER || process.env.USERNAME || 'postgres';
  return `postgresql://${username}@localhost:5432/conductor_test`;
};

// Set default test environment variables if not already set
const testEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'test',
  VITEST: 'true',
  // Use TEST_DATABASE_URL if provided, otherwise use default test database
  DATABASE_URL: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || getDefaultTestUrl(),
};

for (const file of testFiles) {
  console.log(`\n Running ${file}...`);
  execSync(`npx vitest run -c vitest.config.js ${file}`, { 
    stdio: 'inherit',
    env: testEnv
  });
}
