#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const MIN_COVERAGE = 70;

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

const subprocess = spawnSync('npx', ['vitest', 'run', '--coverage', 'src/tests/'], {
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

const summaryLineRaw = subprocess.stdout
  .split('\n')
  .map((line) => line.trim())
  .find((line) => line.toLowerCase().includes('all files'));

if (!summaryLineRaw) {
  console.error('Could not find coverage summary in test output.');
  process.exit(1);
}

const summaryLine = summaryLineRaw.replace(/^ℹ\s*/, '');

// Match: All files | statements | branches | functions | lines |
// Handles variable spacing around numbers
const match = summaryLine.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/i);

if (!match) {
  console.error('Unable to parse coverage summary:', summaryLine);
  process.exit(1);
}

// Extract: statements, branches, functions, lines (we use statements, branches, functions for checks)
const [stmtPct, branchPct, funcPct, linePct] = match.slice(1).map(Number);

const coverageChecks = [
  { label: 'statements', value: stmtPct },
  { label: 'branches', value: branchPct },
  { label: 'functions', value: funcPct },
  { label: 'lines', value: linePct }
];

const failures = coverageChecks.filter(
  (check) => Number.isFinite(check.value) && check.value < MIN_COVERAGE
);

if (failures.length > 0) {
  failures.forEach((check) => {
    console.error(
      `Coverage for ${check.label} is below ${MIN_COVERAGE}%: ${check.value.toFixed(2)}%`
    );
  });
  process.exit(1);
}

console.log('Coverage thresholds met.');
