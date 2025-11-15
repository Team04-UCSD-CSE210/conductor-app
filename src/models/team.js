import { DataTypes } from 'sequelize';

export function defineTeamModel(sequelize) {
  return sequelize.define('Team', {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    offering_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.TEXT, allowNull: false },
    team_number: { type: DataTypes.INTEGER, allowNull: true },
    leader_id: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.ENUM('forming', 'active', 'inactive'), allowNull: true },
    formed_at: { type: DataTypes.DATEONLY, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'team',
    timestamps: false
  });
}

