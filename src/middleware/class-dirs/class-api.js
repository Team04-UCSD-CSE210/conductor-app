import {isUuid} from "../../utils/validation.js";

/**
 * Class API middleware - handles course offering information retrieval
 * Provides endpoints to fetch detailed course metadata, timings, and enrollment status
 */

/**
 * Register Class API routes
 * @param {Express} app - Express application instance
 * @param {Object} options - Configuration options
 * @param {Function} options.authMiddleware - Authentication middleware (ignored; endpoint is public)
 * @param {Object} options.models - Sequelize models { Course, CourseUser, User }
 */
export function registerClassApis(app, { authMiddleware: _authMiddleware, models }) {
    const { Course } = models; // Course should be the CourseOffering model

    // Always use no-op auth to keep endpoint public
    const auth = (_req, _res, next) => next();

    /**
     * GET /api/class/:id
     * Fetch detailed information about a specific course offering
     */
    app.get("/api/class/:id", auth, async (req, res) => {
        const courseId = req.params.id; // course_offerings.id is UUID
        if (!isUuid(courseId)) {
            // Treat non-UUID as not found to avoid DB error surfacing as 500
            return res.status(404).json({ error: "course_not_found" });
        }

        try {
            // Fetch course_offerings row
            const course = await Course.findByPk(courseId);
            if (!course) {
                return res.status(404).json({ error: "course_not_found" });
            }

            // Build response mapping to course_offerings columns
            const response = {
                id: course.id,
                code: course.code,
                name: course.name,
                department: course.department ?? null,
                term: course.term ?? null,
                year: course.year ?? null,
                credits: course.credits ?? null,
                start_date: course.start_date ?? null,
                end_date: course.end_date ?? null,
                enrollment_cap: course.enrollment_cap ?? null,
                status: course.status ?? "open",
                location: course.location ?? null,
                class_timings: course.class_timings || { lectures: [], office_hours: [] },
                syllabus_url: course.syllabus_url ?? null,
                // Enrollment count could be computed from enrollments table when model is available
                currentEnrollment: null,
                createdAt: course.created_at ?? null,
                updatedAt: course.updated_at ?? null,
                created_by: null,
                updated_by: null,
            };

            return res.json(response);
        } catch (err) {
            console.error("Error in GET /api/class/:id", err);
            return res.status(500).json({ error: "internal_error" });
        }
    });
}
