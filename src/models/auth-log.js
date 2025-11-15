import { DataTypes } from 'sequelize';

export function defineAuthLogModel(sequelize) {
  return sequelize.define('AuthLog', {
    eventType: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT },
    userEmail: { type: DataTypes.STRING },
    ipAddress: { type: DataTypes.STRING },
    userId: { type: DataTypes.STRING },
    path: { type: DataTypes.STRING },
    metadata: { type: DataTypes.JSONB, defaultValue: {} }
  }, {
    tableName: 'auth_logs',
    timestamps: true
  });
}
