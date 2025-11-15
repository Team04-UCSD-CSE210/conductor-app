import { DataTypes } from 'sequelize';

export function defineWhitelistModel(sequelize) {
  return sequelize.define('Whitelist', {
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    approved_by: { type: DataTypes.STRING }
  }, {
    tableName: 'whitelist',
    timestamps: true
  });
}
