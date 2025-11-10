import { DataTypes } from 'sequelize';

export const defineAuthLogModel = (sequelize) => {
  return sequelize.define('AuthLog', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    eventType: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'event_type'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    userEmail: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_email'
    },
    ipAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'ip_address'
    },
    userId: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_id'
    },
    path: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'auth_logs',
    timestamps: false,
    indexes: [
      {
        fields: ['event_type', 'created_at']
      },
      {
        fields: ['user_email', 'created_at']
      },
      {
        fields: ['ip_address', 'created_at']
      }
    ]
  });
};