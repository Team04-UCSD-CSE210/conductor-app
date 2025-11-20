import { DataTypes } from 'sequelize';

export function defineCourseModels(sequelize) {
  const Course = sequelize.define('Course', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    created_by: { type: DataTypes.STRING, allowNull: false }, // creator email
  }, {
    tableName: 'courses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const CourseUser = sequelize.define('CourseUser', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    course_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'courses', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    user_id: { 
      type: DataTypes.UUID, 
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    role: { type: DataTypes.ENUM('Professor','TA','Tutor','Student'), allowNull: false },
  }, {
    tableName: 'course_users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'course_users__course_id__user_id', unique: true, fields: ['course_id','user_id'] }
    ]
  });

  const Invite = sequelize.define('Invite', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    course_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: { model: 'courses', key: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    email: { type: DataTypes.STRING, allowNull: true }, // null for UCSD open link
    role: { type: DataTypes.ENUM('Student','TA','Tutor'), allowNull: false },
    token: { type: DataTypes.STRING, allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    accepted_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.STRING, allowNull: false },
    kind: { type: DataTypes.ENUM('ucsd','extension','staff'), allowNull: false },
  }, {
    tableName: 'invites',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return { Course, CourseUser, Invite };
}

export function initCourseAssociations(sequelize, { User, Course, CourseUser, Invite }) {
  Course.hasMany(CourseUser, { foreignKey: 'course_id' });
  CourseUser.belongsTo(Course, { foreignKey: 'course_id' });

  User.hasMany(CourseUser, { foreignKey: 'user_id' });
  CourseUser.belongsTo(User, { foreignKey: 'user_id' });

  Course.hasMany(Invite, { foreignKey: 'course_id' });
  Invite.belongsTo(Course, { foreignKey: 'course_id' });
}
