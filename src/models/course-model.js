import { pool } from '../db.js';

export class CourseModel {
  static validate(data) {
    const errors = [];
    if (!data.name || data.name.trim().length < 2) errors.push('Course name too short');
    if (!data.code || data.code.trim().length < 2) errors.push('Course code too short');
    if (!data.semester || !['fall', 'winter', 'spring', 'summer'].includes(data.semester.toLowerCase())) {
      errors.push('Invalid semester (must be fall, winter, spring, or summer)');
    }
    if (!data.year || data.year < 2020 || data.year > 2030) {
      errors.push('Invalid year (must be between 2020-2030)');
    }
    return errors;
  }

  static async create(data) {
    const errors = this.validate(data);
    if (errors.length) throw new Error(errors.join(', '));

    const query = `
      INSERT INTO courses (name, code, description, semester, year)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      data.name.trim(),
      data.code.trim().toUpperCase(),
      data.description?.trim() || null,
      data.semester.toLowerCase(),
      parseInt(data.year)
    ]);
    return rows[0];
  }

  static async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM courses WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }

  static async findAll(limit = 50, offset = 0) {
    const lim = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
    const off = Math.max(0, parseInt(offset, 10) || 0);
    
    const { rows } = await pool.query(`
      SELECT c.*, 
             COUNT(ucr.user_id) as enrolled_count
      FROM courses c
      LEFT JOIN user_course_roles ucr ON c.id = ucr.course_id
      GROUP BY c.id
      ORDER BY c.year DESC, c.semester, c.name
      LIMIT $1 OFFSET $2
    `, [lim, off]);
    return rows;
  }

  static async update(id, data) {
    const current = await this.findById(id);
    if (!current) throw new Error('Course not found');

    const name = data.name?.trim() || current.name;
    const code = data.code?.trim().toUpperCase() || current.code;
    const description = data.description?.trim() || current.description;
    const semester = data.semester?.toLowerCase() || current.semester;
    const year = data.year ? parseInt(data.year) : current.year;

    const { rows, rowCount } = await pool.query(`
      UPDATE courses
      SET name = $1, code = $2, description = $3, semester = $4, year = $5, updated_at = now()
      WHERE id = $6
      RETURNING *
    `, [name, code, description, semester, year, id]);

    if (rowCount === 0) throw new Error('Course not found');
    return rows[0];
  }

  static async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM courses WHERE id = $1', [id]);
    return rowCount > 0;
  }

  static async findByCode(code) {
    const { rows } = await pool.query(
      'SELECT * FROM courses WHERE code = $1',
      [code.toUpperCase()]
    );
    return rows[0] || null;
  }

  static async getUserCourses(userId) {
    const { rows } = await pool.query(`
      SELECT c.*, ucr.role, ucr.assigned_at
      FROM courses c
      JOIN user_course_roles ucr ON c.id = ucr.course_id
      WHERE ucr.user_id = $1
      ORDER BY c.year DESC, c.semester, c.name
    `, [userId]);
    return rows;
  }
}
