// scripts/run-tests.js
import fs from 'fs';
import { execSync } from 'child_process';

const testFiles = fs
  .readdirSync('src/tests')
  .filter(f => f.endsWith('.test.js'))
  .map(f => `src/tests/${f}`);

for (const file of testFiles) {
  console.log(`\n Running ${file}...`);
  execSync(`npx vitest run -c vitest.config.js ${file}`, { stdio: 'inherit' });
}
