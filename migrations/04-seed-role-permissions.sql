-- Insert default role permissions
INSERT OR IGNORE INTO role_permissions (role, permission, course_specific) VALUES
-- Student permissions
('student', 'view_course', 1),
('student', 'view_queue', 1),
('student', 'view_teams', 1),
('student', 'view_assignments', 1),

-- Team Leader permissions (inherits student + team management)
('team_leader', 'view_course', 1),
('team_leader', 'view_queue', 1),
('team_leader', 'view_teams', 1),
('team_leader', 'manage_teams', 1),
('team_leader', 'view_assignments', 1),

-- Tutor permissions
('tutor', 'view_course', 1),
('tutor', 'view_students', 1),
('tutor', 'view_queue', 1),
('tutor', 'manage_queue', 1),
('tutor', 'help_students', 1),
('tutor', 'view_teams', 1),
('tutor', 'view_assignments', 1),

-- TA permissions (inherits tutor + grading)
('ta', 'view_course', 1),
('ta', 'view_students', 1),
('ta', 'view_queue', 1),
('ta', 'manage_queue', 1),
('ta', 'help_students', 1),
('ta', 'view_teams', 1),
('ta', 'manage_teams', 1),
('ta', 'view_assignments', 1),
('ta', 'grade_assignments', 1),
('ta', 'view_analytics', 1),

-- Professor permissions (full access)
('professor', 'view_course', 1),
('professor', 'edit_course', 1),
('professor', 'delete_course', 1),
('professor', 'view_students', 1),
('professor', 'edit_students', 1),
('professor', 'assign_roles', 1),
('professor', 'view_queue', 1),
('professor', 'manage_queue', 1),
('professor', 'help_students', 1),
('professor', 'view_teams', 1),
('professor', 'manage_teams', 1),
('professor', 'assign_team_leaders', 1),
('professor', 'view_assignments', 1),
('professor', 'create_assignments', 1),
('professor', 'grade_assignments', 1),
('professor', 'view_analytics', 1);
