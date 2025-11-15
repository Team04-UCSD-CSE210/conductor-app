import { DataTypes } from 'sequelize';

export function defineCourseModels(sequelize) {
  const Course = sequelize.define('Course', {
    code: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false }
  }, {
    tableName: 'courses',
    timestamps: false
  });

  const CourseUser = sequelize.define('CourseUser', {
    course_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false }
  }, {
    tableName: 'course_users',
    timestamps: false
  });

  const Invite = sequelize.define('Invite', {
    course_id: { type: DataTypes.INTEGER, allowNull: false },
    email: { type: DataTypes.STRING },
    role: { type: DataTypes.STRING, allowNull: false },
    token: { type: DataTypes.STRING, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    created_by: { type: DataTypes.STRING, allowNull: false },
    kind: { type: DataTypes.STRING, allowNull: false },
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    accepted_at: { type: DataTypes.DATE }
  }, {
    tableName: 'invites',
    timestamps: true
  });

  return { Course, CourseUser, Invite };
}

export function initCourseAssociations(sequelize, { User, Course, CourseUser, Invite }) {
  // Define associations here if needed
}
