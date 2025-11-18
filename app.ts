#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ConductorAppStack } from './lib/conductor-app-stack.js';

const app = new cdk.App();
new ConductorAppStack(app, 'ConductorAppStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
});
