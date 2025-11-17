import {DataTypes} from 'sequelize';

export function defineCourseOfferingModel(sequelize) {
    return sequelize.define('CourseOffering', {
        id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4
        },
        code: {type: DataTypes.TEXT, allowNull: false},
        name: {type: DataTypes.TEXT, allowNull: false},
        department: {type: DataTypes.TEXT, allowNull: true},
        term: {type: DataTypes.TEXT, allowNull: true},
        year: {type: DataTypes.INTEGER, allowNull: true},
        credits: {type: DataTypes.INTEGER, allowNull: true},
        instructor_id: {type: DataTypes.UUID, allowNull: false},
        start_date: {type: DataTypes.DATEONLY, allowNull: false},
        end_date: {type: DataTypes.DATEONLY, allowNull: false},
        enrollment_cap: {type: DataTypes.INTEGER, allowNull: true},
        status: {type: DataTypes.ENUM('open', 'closed', 'completed'), allowNull: true},
        location: {type: DataTypes.TEXT, allowNull: true},
        class_timings: {type: DataTypes.JSONB, allowNull: true},
        syllabus_url: {type: DataTypes.TEXT, allowNull: true},
        is_active: {type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true},
        created_at: {type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW},
        updated_at: {type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW},
        created_by: {type: DataTypes.UUID, allowNull: true},
        updated_by: {type: DataTypes.UUID, allowNull: true}
    }, {
        tableName: 'course_offerings',
        timestamps: false
    });
}

