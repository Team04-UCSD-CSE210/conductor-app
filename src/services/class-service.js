import { CourseOfferingModel } from '../models/course-offerings.js';
import { TeamModel } from '../models/team.js';
import { TeamMemberModel } from '../models/team-members.js';
import { UserModel } from '../models/user-model.js';
import { EnrollmentModel } from '../models/enrollment-model.js';
import { isUuid } from "../utils/validation.js";

/**
 * Class Service - Business logic layer for course/class operations
 * Handles course offerings, teams, and class roster management
 */
export class ClassService {
  /**
   * Get course offering by ID
   * @param {string} courseId - Course UUID
   * @returns {Promise<Object>} Course details
   */
  static async getCourseById(courseId) {
    if (!isUuid(courseId)) {
      throw new Error("INVALID_UUID");
    }

    const course = await CourseOfferingModel.findById(courseId);
    if (!course) {
      throw new Error("COURSE_NOT_FOUND");
    }

    // Get current enrollment count
    const currentEnrollment = await EnrollmentModel.countByOffering(courseId, {
      status: 'enrolled'
    });

    return {
      id: course.id,
      code: course.code,
      name: course.name,
      department: course.department ?? null,
      term: course.term ?? null,
      year: course.year ?? null,
      credits: course.credits ?? null,
      instructorId: course.instructor_id,
      start_date: course.start_date ?? null,
      end_date: course.end_date ?? null,
      enrollment_cap: course.enrollment_cap ?? null,
      status: course.status ?? "open",
      location: course.location ?? null,
      class_timings: course.class_timings || { lectures: [], office_hours: [] },
      syllabus_url: course.syllabus_url ?? null,
      is_active: course.is_active ?? true,
      currentEnrollment,
      createdAt: course.created_at ?? null,
      updatedAt: course.updated_at ?? null,
    };
  }

  /**
   * Get all course offerings with optional filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of course offerings
   */
  static async getCourses(options = {}) {
    return CourseOfferingModel.findAll(options);
  }

  /**
   * Get professor/instructor for a course offering
   * @param {string} offeringId - Course offering UUID
   * @returns {Promise<Array>} Array of professor user cards (single element)
   */
  static async getProfessor(offeringId) {
    if (!isUuid(offeringId)) {
      throw new Error("INVALID_UUID");
    }

    const instructor = await CourseOfferingModel.getInstructorDetails(offeringId);

    if (!instructor) {
      return [];
    }

    return [this._mapUserCard(instructor, { role: "PROFESSOR" })];
  }

  /**
   * Get TAs for a course offering
   * @param {string} offeringId - Course offering UUID
   * @param {Object} options - Query options (search, page, limit)
   * @returns {Promise<Array>} Array of TA user cards
   */
  static async getTAs(offeringId, options = {}) {
    if (!isUuid(offeringId)) {
      throw new Error("INVALID_UUID");
    }

    const page = Number.parseInt(options.page, 10) || 1;
    const limit = Number.parseInt(options.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const users = await UserModel.getUsersByOfferingRole(offeringId, 'ta', {
      search: options.search,
      limit,
      offset,
    });

    return users.map(user => this._mapUserCard(user, { role: "TA" }));
  }

  /**
   * Get tutors for a course offering
   * @param {string} offeringId - Course offering UUID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of tutor user cards
   */
  static async getTutors(offeringId, options = {}) {
    if (!isUuid(offeringId)) {
      throw new Error("INVALID_UUID");
    }

    const page = Number.parseInt(options.page, 10) || 1;
    const limit = Number.parseInt(options.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const users = await UserModel.getUsersByOfferingRole(offeringId, 'tutor', {
      search: options.search,
      limit,
      offset,
    });

    return users.map(user => this._mapUserCard(user, { role: "TUTOR" }));
  }

  /**
   * Get students for a course offering
   * @param {string} offeringId - Course offering UUID
   * @param {Object} options - Query options (search, page, limit)
   * @returns {Promise<Array>} Array of student user cards
   */
  static async getStudents(offeringId, options = {}) {
    if (!isUuid(offeringId)) {
      throw new Error("INVALID_UUID");
    }

    const page = Number.parseInt(options.page, 10) || 1;
    const limit = Number.parseInt(options.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const users = await UserModel.getUsersByOfferingRole(offeringId, 'student', {
      search: options.search,
      limit,
      offset,
    });

    return users.map(user => this._mapUserCard(user, { role: "STUDENT" }));
  }

  /**
   * Get groups/teams for a course offering
   * @param {string} offeringId - Course offering UUID
   * @param {Object} options - Query options (search, sort, page, limit)
   * @returns {Promise<Array>} Array of team objects with member info
   */
  static async getGroups(offeringId, options = {}) {
    if (!isUuid(offeringId)) {
      throw new Error("INVALID_UUID");
    }

    const page = Number.parseInt(options.page, 10) || 1;
    const limit = Number.parseInt(options.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const sort = options.sort || 'name';

    // Get teams with optional search
    let teams = await TeamModel.findByOffering(offeringId, { limit, offset });

    // Apply search filter if provided (client-side for now)
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      teams = teams.filter(t =>
        t.name.toLowerCase().includes(searchLower)
      );
    }

    // Sort teams
    if (sort === 'number') {
      teams.sort((a, b) => (a.team_number ?? 999) - (b.team_number ?? 999));
    } else {
      teams.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (teams.length === 0) return [];

    const teamIds = teams.map(t => t.id);

    // Get member counts and leaders for all teams
    const [memberCounts, leaders] = await Promise.all([
      TeamMemberModel.countByTeams(teamIds),
      TeamMemberModel.getLeadersByTeams(teamIds),
    ]);

    // Build maps for quick lookup
    const memberCountMap = new Map();
    memberCounts.forEach(row => {
      memberCountMap.set(row.team_id, Number.parseInt(row.member_count, 10));
    });

    const leadersByTeam = new Map();
    leaders.forEach(row => {
      if (!leadersByTeam.has(row.team_id)) {
        leadersByTeam.set(row.team_id, []);
      }
      leadersByTeam.get(row.team_id).push({ userId: row.user_id });
    });

    // Map to final format
    return teams.map(team => ({
      teamId: team.id,
      name: team.name,
      status: team.status || "active",
      number: team.team_number ?? null,
      memberCount: memberCountMap.get(team.id) || 0,
      leaders: leadersByTeam.get(team.id) || [],
    }));
  }

  /**
   * Get detailed information about a specific team
   * @param {string} teamId - Team UUID
   * @returns {Promise<Object>} Team details with members
   */
  static async getTeamDetails(teamId) {
    if (!isUuid(teamId)) {
      throw new Error("INVALID_UUID");
    }

    const team = await TeamModel.findById(teamId);
    if (!team) {
      throw new Error("TEAM_NOT_FOUND");
    }

    const members = await TeamMemberModel.findByTeam(teamId, { active: true });
    const memberCount = await TeamMemberModel.count({ team_id: teamId, active: true });

    return {
      ...team,
      memberCount,
      members,
    };
  }

  /**
   * Map database user row to user card object
   * Provides consistent user card format across all methods
   * @private
   */
  static _mapUserCard(user, extra = {}) {
    return {
      userId: user.id,
      name: user.name,
      preferredName: user.preferred_name ?? user.name ?? null,
      photo: user.image_url ?? null,
      email: user.email,
      phone: user.phone_number ?? null,
      links: {
        linkedin: user.linkedin_url ?? null,
        github: user.github_username ?? null,
      },
      ...extra,
      availability: extra.availability ?? [],
    };
  }
}
