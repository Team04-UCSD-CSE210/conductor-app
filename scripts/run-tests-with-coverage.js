#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const MIN_COVERAGE = 80;

const subprocess = spawnSync('npx', ['vitest', 'run', '--coverage', 'src/tests/'], {
  env: process.env,
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
  .find((line) => line.includes('all files'));

if (!summaryLineRaw) {
  console.error('Could not find coverage summary in test output.');
  process.exit(1);
}

const summaryLine = summaryLineRaw.replace(/^ℹ\s*/, '');

const match = summaryLine.match(/all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/);

if (!match) {
  console.error('Unable to parse coverage summary:', summaryLine);
  process.exit(1);
}

const [linePct, branchPct, funcPct] = match.slice(1).map(Number);

const coverageChecks = [
  { label: 'lines', value: linePct },
  { label: 'branches', value: branchPct },
  { label: 'functions', value: funcPct }
];

const failures = coverageChecks.filter((check) => Number.isFinite(check.value) && check.value < MIN_COVERAGE);

if (failures.length > 0) {
  failures.forEach((check) => {
    console.error(`Coverage for ${check.label} is below ${MIN_COVERAGE}%: ${check.value.toFixed(2)}%`);
  });
  process.exit(1);
}

console.log('Coverage thresholds met.');
