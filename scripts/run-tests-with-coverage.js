#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

// Set test environment variables
const testEnv = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'test',
};

// Run tests using Node's built-in test runner
const subprocess = spawnSync('node', ['--test', 'src/tests/session.test.js', 'src/tests/attendance.test.js'], {
  env: testEnv,
  encoding: 'utf-8'
});

if (subprocess.stdout) {
  process.stdout.write(subprocess.stdout);
}

if (subprocess.stderr) {
  process.stderr.write(subprocess.stderr);
}

if (subprocess.error) {
  console.error('Failed to run tests:', subprocess.error.message);
  process.exit(1);
}

if (typeof subprocess.status === 'number' && subprocess.status !== 0) {
  process.exit(subprocess.status);
}

console.log('\n✅ All tests passed!');
