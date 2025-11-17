#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Setting up Vercel deployment...\n');

// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'ignore' });
  console.log('✅ Vercel CLI is installed');
} catch {
  console.log('📦 Installing Vercel CLI...');
  execSync('npm install -g vercel', { stdio: 'inherit' });
}

// Check if project is linked to Vercel
const vercelDir = path.join(process.cwd(), '.vercel');
if (!fs.existsSync(vercelDir)) {
  console.log('\n🔗 Linking project to Vercel...');
  console.log('Please follow the prompts to link your project:');
  execSync('vercel link', { stdio: 'inherit' });
} else {
  console.log('✅ Project is already linked to Vercel');
}

// Read project configuration
let projectConfig = {};
const projectJsonPath = path.join(vercelDir, 'project.json');
if (fs.existsSync(projectJsonPath)) {
  projectConfig = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
  console.log(`✅ Project ID: ${projectConfig.projectId}`);
  console.log(`✅ Org ID: ${projectConfig.orgId}`);
}

console.log('\n📋 Next steps:');
console.log('1. Add environment variables in Vercel dashboard');
console.log('2. Set up external database (PostgreSQL) and Redis');
console.log('3. Update Google OAuth callback URLs');
console.log('4. Add GitHub secrets for CI/CD');
console.log('5. Push to main branch to trigger deployment');

console.log('\n🔧 GitHub Secrets needed:');
console.log(`VERCEL_TOKEN=<your-vercel-token>`);
console.log(`VERCEL_ORG_ID=${projectConfig.orgId || '<your-org-id>'}`);
console.log(`VERCEL_PROJECT_ID=${projectConfig.projectId || '<your-project-id>'}`);
console.log('SLACK_BOT_TOKEN=<your-slack-token>');
console.log('SLACK_CHANNEL_ID=<your-slack-channel>');

console.log('\n📖 See VERCEL_DEPLOYMENT.md for detailed instructions');
console.log('🎉 Setup complete!');
