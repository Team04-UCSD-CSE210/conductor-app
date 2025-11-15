// src/middleware/class-dirs/class-users-api.js
import { QueryTypes } from "sequelize";
import { isUuid } from "../../utils/validation.js";

/**
 * Class Directory - User APIs
 *
 * Exposed routes:
 *   - GET /api/class/:offeringId/professor
 *   - GET /api/class/:offeringId/tas
 *   - GET /api/class/ta/:taId
 *   - GET /api/class/:offeringId/students
 *
 * Data sources (matching schema.sql + api-contracts.md):
 *   - course_offerings
 *   - enrollments
 *   - users
 *
 * Notes:
 *   - We intentionally do NOT use the legacy "course_users" table.
 *   - All queries are implemented with raw SQL via sequelize.query.
 */

export function registerClassUserApis(
  app,
  { authMiddleware: _authMiddleware, models = {} } = {},
) {
  console.log("📝 registerClassUserApis called, models:", Object.keys(models));

  const { User } = models;
  if (!User || !User.sequelize) {
    console.error(
      "Class user APIs: User model with a valid sequelize instance is required.",
    );
    return;
  }

  const sequelize = User.sequelize;

  /**
   * Helper: parse a positive integer from query string.
   */
  function toPositiveInt(value, fallback) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /**
   * Helper: map a DB row to the common “directory card” shape.
   * Extra fields (role, section, etc.) can be passed via the `extra` object.
   */
  function mapUserToDirectoryCard(row, extra = {}) {
    return {
      userId: row.user_id,
      name: row.name,
      preferredName: row.preferred_name ?? row.name ?? null,
      pronouns: null, // not modeled in DB yet
      photo: row.image_url ?? null,
      email: row.email,
      phone: row.phone_number ?? null,
      links: {
        linkedin: row.linkedin_url ?? null,
        github: row.github_username ?? null,
        office_hours: null,
        class_chat: null,
      },
      ...extra,
      availability: extra.availability ?? [], // can be wired to an Availability table in future
    };
  }

  // ---------------------------------------------------------------------------
  // GET /api/class/:offeringId/professor
  //
  // Backend logic (from api-contracts.md):
  //   - Query Course_Offerings → instructor_id
  //   - Join Users and Availability
  // Here we implement: course_offerings + users. Availability is left empty.
  // ---------------------------------------------------------------------------
  app.get("/api/class/:offeringId/professor", async (req, res) => {
    const { offeringId } = req.params;

    if (!isUuid(offeringId)) {
      return res.status(400).json({ error: "invalid_offering_id" });
    }

    try {
      const rows = await sequelize.query(
        `
        SELECT
          co.id             AS offering_id,
          u.id              AS user_id,
          u.name            AS name,
          u.preferred_name  AS preferred_name,
          u.email           AS email,
          u.image_url       AS image_url,
          u.phone_number    AS phone_number,
          u.github_username AS github_username,
          u.linkedin_url    AS linkedin_url
        FROM course_offerings co
        JOIN users u
          ON u.id = co.instructor_id
        WHERE co.id = :offeringId
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { offeringId },
        },
      );

      if (!rows || rows.length === 0) {
        // No instructor found for this offering; return an empty list.
        return res.json({
          offeringId,
          professors: [],
        });
      }

      const professor = mapUserToDirectoryCard(rows[0], {
        // Example: in future we could add pronouns, office_hours, availability here.
        availability: [],
      });

      return res.json({
        offeringId,
        professors: [professor],
      });
    } catch (err) {
      console.error("Error in GET /api/class/:offeringId/professor", err);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/class/:offeringId/tas
  //
  // Backend logic:
  //   - ENROLLMENTS where role = 'ta' for the given offeringId
  //   - Join Users and Availability
  // Here we implement: enrollments + users, availability as empty array.
  // ---------------------------------------------------------------------------
  app.get("/api/class/:offeringId/tas", async (req, res) => {
    const { offeringId } = req.params;

    if (!isUuid(offeringId)) {
      return res.status(400).json({ error: "invalid_offering_id" });
    }

    try {
      const rows = await sequelize.query(
        `
        SELECT
          e.offering_id     AS offering_id,
          u.id              AS user_id,
          u.name            AS name,
          u.preferred_name  AS preferred_name,
          u.email           AS email,
          u.image_url       AS image_url,
          u.phone_number    AS phone_number,
          u.github_username AS github_username,
          u.linkedin_url    AS linkedin_url
        FROM enrollments e
        JOIN users u
          ON u.id = e.user_id
        WHERE e.offering_id = :offeringId
          AND e.course_role = 'ta'
          AND e.status = 'enrolled'
        ORDER BY u.name ASC;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { offeringId },
        },
      );

      const tas = rows.map((row) =>
        mapUserToDirectoryCard(row, {
          section: null, // section is not modeled in schema.sql; placeholder
          role: "TA",
          availability: [],
          activity: null, // future: link to attendance / activity tracking
        }),
      );

      return res.json({
        offeringId,
        tas,
      });
    } catch (err) {
      console.error("Error in GET /api/class/:offeringId/tas", err);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/class/ta/:taId
  //
  // Backend logic:
  //   - Query ENROLLMENTS where role = 'ta' for the given taId
  //   - Join Users and Availability
  //
  // For now we:
  //   - Look up the user by id
  //   - Optionally join enrollments to check that they have at least one TA role
  //   - Return a TA directory card
  // ---------------------------------------------------------------------------
  app.get("/api/class/ta/:taId", async (req, res) => {
    const { taId } = req.params;

    if (!isUuid(taId)) {
      return res.status(400).json({ error: "invalid_ta_id" });
    }

    try {
      const rows = await sequelize.query(
        `
        SELECT
          u.id              AS user_id,
          u.name            AS name,
          u.preferred_name  AS preferred_name,
          u.email           AS email,
          u.image_url       AS image_url,
          u.phone_number    AS phone_number,
          u.github_username AS github_username,
          u.linkedin_url    AS linkedin_url
        FROM users u
        WHERE u.id = :taId
        LIMIT 1;
        `,
        {
          type: QueryTypes.SELECT,
          replacements: { taId },
        },
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "ta_not_found" });
      }

      const taCard = mapUserToDirectoryCard(rows[0], {
        section: null,
        role: "TA",
        availability: [],
        activity: null,
      });

      return res.json(taCard);
    } catch (err) {
      console.error("Error in GET /api/class/ta/:taId", err);
      return res.status(500).json({ error: "internal_error" });
    }
  });

  // ---------------------------------------------------------------------------
  // GET /api/class/:offeringId/students
  //
  // Backend logic:
  //   - ENROLLMENTS where role = 'student'
  //   - Filters:
  //       - section (not modeled in current schema → placeholder)
  //       - search (name / preferred_name / email)
  //       - group (by group name → TODO; not wired to TEAM tables yet)
  //   - Pagination:
  //       - page (default 1)
  //       - limit (default 20)
  //
  // Current implementation:
  //   - Uses enrollments + users
  //   - Honors search + page + limit
  //   - Ignores section / group filters for now (no columns in schema.sql)
  // ---------------------------------------------------------------------------
  app.get("/api/class/:offeringId/students", async (req, res) => {
    const { offeringId } = req.params;
    const { search } = req.query;

    if (!isUuid(offeringId)) {
      return res.status(400).json({ error: "invalid_offering_id" });
    }

    const page = toPositiveInt(req.query.page, 1);
    const limit = toPositiveInt(req.query.limit, 20);
    const offset = (page - 1) * limit;

    try {
      const whereClauses = [
        "e.offering_id = :offeringId",
        "e.course_role = 'student'",
        "e.status = 'enrolled'",
      ];

      const replacements = {
        offeringId,
        limit,
        offset,
      };

      if (search && String(search).trim().length > 0) {
        const like = `%${String(search).trim()}%`;
        whereClauses.push(
          "(u.name ILIKE :search OR u.preferred_name ILIKE :search OR u.email ILIKE :search)",
        );
        replacements.search = like;
      }

      const sql = `
        SELECT
          e.offering_id     AS offering_id,
          u.id              AS user_id,
          u.name            AS name,
          u.preferred_name  AS preferred_name,
          u.email           AS email,
          u.image_url       AS image_url,
          u.phone_number    AS phone_number,
          u.github_username AS github_username,
          u.linkedin_url    AS linkedin_url
        FROM enrollments e
        JOIN users u
          ON u.id = e.user_id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY u.name ASC
        LIMIT :limit OFFSET :offset;
      `;

      const rows = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
        replacements,
      });

      const students = rows.map((row) =>
        mapUserToDirectoryCard(row, {
          section: null, // not in schema yet
          role: "STUDENT",
          attendance: {
            lectures: 0,
            meetings: 0,
            officeHours: 0,
          },
          activity: {
            punchCard: [],
          },
        }),
      );

      return res.json({
        offeringId,
        students,
      });
    } catch (err) {
      console.error("Error in GET /api/class/:offeringId/students", err);
      return res.status(500).json({ error: "internal_error" });
    }
  });
}
