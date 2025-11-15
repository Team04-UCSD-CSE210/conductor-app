import { DataTypes } from 'sequelize';

export function defineUserModel(sequelize) {
  return sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    email: { type: DataTypes.CITEXT || DataTypes.TEXT, allowNull: false },
    ucsd_pid: { type: DataTypes.TEXT, allowNull: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    preferred_name: { type: DataTypes.TEXT, allowNull: true },
    major: { type: DataTypes.TEXT, allowNull: true },
    degree_program: { type: DataTypes.TEXT, allowNull: true },
    academic_year: { type: DataTypes.INTEGER, allowNull: true },
    department: { type: DataTypes.TEXT, allowNull: true },
    class_level: { type: DataTypes.TEXT, allowNull: true },
    primary_role: { type: DataTypes.ENUM('admin', 'instructor', 'student'), allowNull: false },
    status: { type: DataTypes.ENUM('active', 'busy', 'inactive'), allowNull: false },
    institution_type: { type: DataTypes.ENUM('ucsd', 'extension'), allowNull: true },
    profile_url: { type: DataTypes.TEXT, allowNull: true },
    image_url: { type: DataTypes.TEXT, allowNull: true },
    phone_number: { type: DataTypes.TEXT, allowNull: true },
    github_username: { type: DataTypes.TEXT, allowNull: true },
    linkedin_url: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'users',
    timestamps: false
  });
}

