import { Sequelize } from 'sequelize';

const buildDialectOptions = (sslMode) => {
  if (!sslMode || sslMode === 'disable') {
    return {};
  }

  if (sslMode === 'no-verify') {
    return {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    };
  }

  return {
    ssl: {
      require: true,
      rejectUnauthorized: true
    }
  };
};

export const createSequelize = ({ databaseUrl, sslMode }) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be provided');
  }

  const dialectOptions = buildDialectOptions(sslMode);

  return new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions,
    logging: false
  });
};