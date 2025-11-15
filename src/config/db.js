import { Sequelize } from 'sequelize';

export function createSequelize({ databaseUrl, sslMode }) {
  const sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: sslMode === 'require' ? { require: true, rejectUnauthorized: false } : false
    },
    logging: false
  });
  
  return sequelize;
}
