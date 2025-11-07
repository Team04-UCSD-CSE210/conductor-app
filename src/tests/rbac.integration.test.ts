// src/tests/rbac.integration.test.ts
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { pool } from "../db";

const ADMIN_ID      = "00000000-0000-0000-0000-000000000001";
const INSTRUCTOR_ID = "00000000-0000-0000-0000-000000000002";
const TA_ID         = "00000000-0000-0000-0000-000000000003";
const STUDENT_ID    = "00000000-0000-0000-0000-000000000004";

const TEMPLATE_ID   = "20000000-0000-0000-0000-000000000001";
const COURSE_ID     = "10000000-0000-0000-0000-000000000001";

const TEAM_ID       = "40000000-0000-0000-0000-000000000001";

beforeAll(async () => {
  // --- sanity: make sure RBAC core exists ---
  const perm = await pool.query<{ reg: string | null }>(
    "SELECT to_regclass('public.permissions') AS reg"
  );
  if (!perm.rows[0]?.reg) {
    throw new Error(
      "[rbac test] permissions table not found. Ensure 03-rbac-and-permissions.sql has been run."
    );
  }

  const func = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_proc
       WHERE proname = 'can_user_do_course_action'
     ) AS exists;`
  );
  if (!func.rows[0]?.exists) {
    throw new Error(
      "[rbac test] can_user_do_course_action() not found. Ensure RBAC functions are created."
    );
  }

  // --- clean up any old fixtures (in FK-safe order) ---

  await pool.query(
    `DELETE FROM team_members WHERE team_id = $1
       OR user_id IN ($2, $3, $4);`,
    [TEAM_ID, STUDENT_ID, TA_ID, INSTRUCTOR_ID]
  );

  await pool.query(
    `DELETE FROM team WHERE id = $1;`,
    [TEAM_ID]
  );

  await pool.query(
    `DELETE FROM enrollments
      WHERE offering_id = $1
         OR user_id IN ($2, $3, $4);`,
    [COURSE_ID, INSTRUCTOR_ID, TA_ID, STUDENT_ID]
  );

  await pool.query(
    `DELETE FROM course_offerings
      WHERE id = $1
         OR template_id = $2;`,
    [COURSE_ID, TEMPLATE_ID]
  );

  await pool.query(
    `DELETE FROM course_template WHERE id = $1;`,
    [TEMPLATE_ID]
  );

  await pool.query(
    `DELETE FROM users
      WHERE id IN ($1, $2, $3, $4)
         OR email IN (
           'admin@test.local',
           'instructor@test.local',
           'ta@test.local',
           'student@test.local'
         );`,
    [ADMIN_ID, INSTRUCTOR_ID, TA_ID, STUDENT_ID]
  );

  // --- fixtures: users ---

  await pool.query(
    `INSERT INTO users (id, email, role)
     VALUES
      ($1, 'admin@test.local',      'admin'),
      ($2, 'instructor@test.local', 'instructor'),
      ($3, 'ta@test.local',         'student'),
      ($4, 'student@test.local',    'student');`,
    [ADMIN_ID, INSTRUCTOR_ID, TA_ID, STUDENT_ID]
  );

  // --- fixtures: course template ---

  await pool.query(
    `INSERT INTO course_template (id, code, name, department, description, credits, is_active)
     VALUES ($1, 'CSE210', 'Software Engineering', 'CSE', 'RBAC Test Template', 4, TRUE);`,
    [TEMPLATE_ID]
  );

  // --- One course offering with instructor (this is the part you asked about) ---

  await pool.query(
    `INSERT INTO course_offerings (
       id,
       template_id,
       term,
       year,
       section,
       instructor_id,
       start_date,
       end_date,
       status
     )
     VALUES (
       $1,
       $2,
       'Fall',
       2025,
       'A00',
       $3,
       CURRENT_DATE,
       CURRENT_DATE + INTERVAL '90 days',
       'open'
     );`,
    [COURSE_ID, TEMPLATE_ID, INSTRUCTOR_ID]
  );

  // --- fixtures: enrollments (TA + student in that offering) ---

  await pool.query(
    `INSERT INTO enrollments (
       offering_id,
       user_id,
       role,
       status,
       enrolled_at
     )
     VALUES
       ($1, $2, 'ta',      'enrolled', CURRENT_DATE),
       ($1, $3, 'student', 'enrolled', CURRENT_DATE);`,
    [COURSE_ID, TA_ID, STUDENT_ID]
  );

  // --- fixtures: team + team_members (uses your 'team' table, singular) ---

  await pool.query(
    `INSERT INTO team (
       id,
       offering_id,
       name,
       team_number,
       leader_id,
       is_active,
       formed_at
     )
     VALUES (
       $1,
       $2,
       'Test Team A',
       1,
       $3,
       TRUE,
       CURRENT_DATE
     );`,
    [TEAM_ID, COURSE_ID, STUDENT_ID]
  );

  await pool.query(
    `INSERT INTO team_members (team_id, user_id, role, joined_at)
     VALUES
       ($1, $2, 'leader', CURRENT_DATE),
       ($1, $3, 'member', CURRENT_DATE);`,
    [TEAM_ID, STUDENT_ID, TA_ID]
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM team_members WHERE team_id = $1;`, [TEAM_ID]);
  await pool.query(`DELETE FROM team WHERE id = $1;`, [TEAM_ID]);

  await pool.query(`DELETE FROM enrollments WHERE offering_id = $1;`, [COURSE_ID]);

  await pool.query(
    `DELETE FROM course_offerings
      WHERE id = $1 OR template_id = $2;`,
    [COURSE_ID, TEMPLATE_ID]
  );

  await pool.query(`DELETE FROM course_template WHERE id = $1;`, [TEMPLATE_ID]);

  await pool.query(
    `DELETE FROM users
      WHERE id IN ($1, $2, $3, $4)
         OR email IN (
           'admin@test.local',
           'instructor@test.local',
           'ta@test.local',
           'student@test.local'
         );`,
    [ADMIN_ID, INSTRUCTOR_ID, TA_ID, STUDENT_ID]
  );
});

// ---------- Tests ----------

describe("RBAC integration: course permissions", () => {
  it("instructor can manage roster for their course", async () => {
    const { rows } = await pool.query<{ allowed: boolean }>(
      `SELECT can_user_do_course_action($1, $2, 'roster', 'manage') AS allowed;`,
      [INSTRUCTOR_ID, COURSE_ID]
    );
    expect(rows[0]?.allowed).toBe(true);
  });

  it("TA can view roster and grade submissions, but cannot manage roster", async () => {
    const roster = await pool.query<{ allowed: boolean }>(
      `SELECT can_user_do_course_action($1, $2, 'roster', 'view') AS allowed;`,
      [TA_ID, COURSE_ID]
    );
    expect(roster.rows[0]?.allowed).toBe(true);

    const grade = await pool.query<{ allowed: boolean }>(
      `SELECT can_user_do_course_action($1, $2, 'submission', 'grade') AS allowed;`,
      [TA_ID, COURSE_ID]
    );
    expect(grade.rows[0]?.allowed).toBe(true);

    const manage = await pool.query<{ allowed: boolean }>(
      `SELECT can_user_do_course_action($1, $2, 'roster', 'manage') AS allowed;`,
      [TA_ID, COURSE_ID]
    );
    expect(manage.rows[0]?.allowed).toBe(false);
  });

  it("student can view announcements but cannot manage roster", async () => {
    const view = await pool.query<{ allowed: boolean }>(
      `SELECT can_user_do_course_action($1, $2, 'announcement', 'view') AS allowed;`,
      [STUDENT_ID, COURSE_ID]
    );
    expect(view.rows[0]?.allowed).toBe(true);

    const manage = await pool.query<{ allowed: boolean }>(
      `SELECT can_user_do_course_action($1, $2, 'roster', 'manage') AS allowed;`,
      [STUDENT_ID, COURSE_ID]
    );
    expect(manage.rows[0]?.allowed).toBe(false);
  });
});

describe("RBAC integration: team permissions", () => {
  it("team leader can manage their own team; member cannot", async () => {
    const leader = await pool.query<{ allowed: boolean }>(
      `SELECT can_user_do_team_action($1, $2, 'team', 'manage_own') AS allowed;`,
      [STUDENT_ID, TEAM_ID]
    );
    expect(leader.rows[0]?.allowed).toBe(true);

    const member = await pool.query<{ allowed: boolean }>(
      `SELECT can_user_do_team_action($1, $2, 'team', 'manage_own') AS allowed;`,
      [TA_ID, TEAM_ID]
    );
    expect(member.rows[0]?.allowed).toBe(false);
  });
});
