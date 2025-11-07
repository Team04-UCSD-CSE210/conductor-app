import test from 'node:test';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import { defineAuthLogModel } from '../src/models/auth-log.js';

const createModel = () => {
  const sequelize = new Sequelize('postgres://user:pass@localhost:5432/db', {
    dialect: 'postgres',
    logging: false
  });
  const AuthLog = defineAuthLogModel(sequelize);
  return { sequelize, AuthLog };
};

test('AuthLog defines default metadata payload', async () => {
  const { sequelize, AuthLog } = createModel();

  const log = AuthLog.build({
    eventType: 'login_success',
    message: 'User logged in',
    userEmail: 'student@ucsd.edu'
  });

  assert.deepEqual(log.metadata, {});

  await sequelize.close();
});

test('AuthLog stores JSON metadata payloads when provided', async () => {
  const { sequelize, AuthLog } = createModel();

  const metadata = { attempts: 2, reason: 'invalid_domain' };
  const log = AuthLog.build({
    eventType: 'login_failure',
    metadata
  });

  assert.deepEqual(log.metadata, metadata);

  await sequelize.close();
});
