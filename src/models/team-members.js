import { DataTypes } from 'sequelize';

export function defineTeamMembersModel(sequelize) {
  return sequelize.define('TeamMember', {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    team_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    role: { type: DataTypes.ENUM('leader', 'member'), allowNull: true },
    joined_at: { type: DataTypes.DATEONLY, allowNull: true },
    left_at: { type: DataTypes.DATEONLY, allowNull: true },
    removed_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'team_members',
    timestamps: false
  });
}

