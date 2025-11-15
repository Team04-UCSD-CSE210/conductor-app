import { DataTypes } from 'sequelize';

export function defineAccessRequestModel(sequelize) {
  return sequelize.define('AccessRequest', {
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    reason: { type: DataTypes.TEXT },
    requested_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'access_requests',
    timestamps: false
  });
}
