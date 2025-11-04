import test from 'node:test';
import assert from 'node:assert/strict';
import { createSequelize } from '../database.js';

const closeConnection = async (sequelize) => {
  if (sequelize) {
    await sequelize.close();
  }
};

test('createSequelize throws when databaseUrl is missing', () => {
  assert.throws(() => createSequelize({ databaseUrl: null }), /DATABASE_URL must be provided/);
});

test('createSequelize uses postgres dialect with SSL disabled by default', async () => {
  const sequelize = createSequelize({
    databaseUrl: 'postgres://user:pass@localhost:5432/db'
  });

  assert.equal(sequelize.getDialect(), 'postgres');
  assert.equal(sequelize.options.dialectOptions?.ssl, undefined);

  await closeConnection(sequelize);
});

test('createSequelize respects no-verify SSL mode', async () => {
  const sequelize = createSequelize({
    databaseUrl: 'postgres://user:pass@localhost:5432/db',
    sslMode: 'no-verify'
  });

  assert.deepEqual(sequelize.options.dialectOptions.ssl, {
    require: true,
    rejectUnauthorized: false
  });

  await closeConnection(sequelize);
});
