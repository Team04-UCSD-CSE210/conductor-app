/**
 * Script to list all courses from the database
 * Usage: node scripts/list-courses.js
 */

import { createSequelize } from '../src/config/db.js';
import { defineCourseModels } from '../src/models/course-models.js';
import { initCourseAssociations } from '../src/models/course-models.js';

async function listCourses() {
  try {
    console.log('Connecting to database...');
    const sequelize = createSequelize();

    // Define models
    const { Course, CourseUser } = defineCourseModels(sequelize);
    initCourseAssociations(sequelize, { Course, CourseUser });

    // Sync models
    await sequelize.sync();

    // Fetch all courses
    const courses = await Course.findAll(); 

    if (courses.length === 0) {
      console.log('No courses found in the database.');
    } else {
      console.log('\n📚 Available Courses:');
      console.log('='.repeat(80));
      courses.forEach((course) => {
        console.log(`ID: ${course.id}`);
        console.log(`Code: ${course.code}`);
        console.log(`Title: ${course.title}`);
        console.log(`Created by: ${course.created_by}`);
        console.log('-'.repeat(80));
      });
    }

    await sequelize.close();
  } catch (err) {
    console.error('Error fetching courses:', err);
    process.exit(1);
  }
}

listCourses();
