-- Add fake users with profile information
INSERT INTO users (id, name, preferred_name, email, phone, pronouns, availability, social_links, profile_picture, primary_role, last_activity) VALUES
-- Professors
('550e8400-e29b-41d4-a716-446655440001', 'Dr. Sarah Johnson', 'Sarah', 'sarah.johnson@ucsd.edu', '(858) 555-0101', 'she/her', 'Mon-Fri 9AM-5PM, Office Hours: Tue/Thu 2-4PM', '{"linkedin": "https://linkedin.com/in/sarahjohnson", "twitter": "@sarahj_prof"}', 'https://via.placeholder.com/150/4F46E5/FFFFFF?text=SJ', 'instructor', NOW() - INTERVAL '2 hours'),
('550e8400-e29b-41d4-a716-446655440002', 'Prof. Michael Chen', 'Mike', 'mchen@ucsd.edu', '(858) 555-0102', 'he/him', 'Mon-Wed-Fri 10AM-6PM', '{"website": "https://michaelchen.dev"}', 'https://via.placeholder.com/150/059669/FFFFFF?text=MC', 'instructor', NOW() - INTERVAL '1 day'),

-- TAs
('550e8400-e29b-41d4-a716-446655440003', 'Alex Rodriguez', 'Alex', 'arodriguez@ucsd.edu', '(858) 555-0103', 'they/them', 'Tue/Thu 1-5PM, Available on Slack', '{"github": "https://github.com/alexr", "slack": "@alex.rodriguez"}', 'https://via.placeholder.com/150/DC2626/FFFFFF?text=AR', 'student', NOW() - INTERVAL '30 minutes'),
('550e8400-e29b-41d4-a716-446655440004', 'Emma Wilson', 'Emma', 'ewilson@ucsd.edu', '(858) 555-0104', 'she/her', 'Mon/Wed/Fri 2-6PM', '{"linkedin": "https://linkedin.com/in/emmawilson"}', 'https://via.placeholder.com/150/7C3AED/FFFFFF?text=EW', 'student', NOW() - INTERVAL '1 hour'),

-- Tutors
('550e8400-e29b-41d4-a716-446655440005', 'James Park', 'James', 'jpark@ucsd.edu', '(858) 555-0105', 'he/him', 'Weekends 10AM-4PM, Evening hours available', '{"github": "https://github.com/jamespark", "discord": "james#1234"}', 'https://via.placeholder.com/150/EA580C/FFFFFF?text=JP', 'student', NOW() - INTERVAL '3 hours'),
('550e8400-e29b-41d4-a716-446655440006', 'Priya Patel', 'Priya', 'ppatel@ucsd.edu', '(858) 555-0106', 'she/her', 'Tue/Thu 3-7PM, Flexible schedule', '{"website": "https://priyapatel.dev", "twitter": "@priya_codes"}', 'https://via.placeholder.com/150/10B981/FFFFFF?text=PP', 'student', NOW() - INTERVAL '45 minutes'),

-- Students
('550e8400-e29b-41d4-a716-446655440007', 'David Kim', 'Dave', 'dkim@ucsd.edu', '(858) 555-0107', 'he/him', 'Evenings after 6PM, Weekends', '{"github": "https://github.com/davekim", "instagram": "@dave.codes"}', 'https://via.placeholder.com/150/3B82F6/FFFFFF?text=DK', 'student', NOW() - INTERVAL '2 days'),
('550e8400-e29b-41d4-a716-446655440008', 'Lisa Zhang', 'Lisa', 'lzhang@ucsd.edu', '(858) 555-0108', 'she/her', 'Mon-Fri after 4PM', '{"linkedin": "https://linkedin.com/in/lisazhang", "github": "https://github.com/lisaz"}', 'https://via.placeholder.com/150/F59E0B/FFFFFF?text=LZ', 'student', NOW() - INTERVAL '6 hours'),
('550e8400-e29b-41d4-a716-446655440009', 'Carlos Martinez', 'Carlos', 'cmartinez@ucsd.edu', '(858) 555-0109', 'he/him', 'Flexible, prefer mornings', '{"twitter": "@carlos_dev", "website": "https://carlosm.dev"}', 'https://via.placeholder.com/150/EF4444/FFFFFF?text=CM', 'student', NOW() - INTERVAL '4 hours');

-- Add enrollments for these users
INSERT INTO enrollments (user_id, offering_id, course_role, status) VALUES
-- Get the active offering ID (assuming CSE 210 Fall 2025)
('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM course_offerings WHERE code = 'CSE 210' LIMIT 1), 'instructor', 'enrolled'),
('550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM course_offerings WHERE code = 'CSE 210' LIMIT 1), 'instructor', 'enrolled'),
('550e8400-e29b-41d4-a716-446655440003', (SELECT id FROM course_offerings WHERE code = 'CSE 210' LIMIT 1), 'ta', 'enrolled'),
('550e8400-e29b-41d4-a716-446655440004', (SELECT id FROM course_offerings WHERE code = 'CSE 210' LIMIT 1), 'ta', 'enrolled'),
('550e8400-e29b-41d4-a716-446655440005', (SELECT id FROM course_offerings WHERE code = 'CSE 210' LIMIT 1), 'tutor', 'enrolled'),
('550e8400-e29b-41d4-a716-446655440006', (SELECT id FROM course_offerings WHERE code = 'CSE 210' LIMIT 1), 'tutor', 'enrolled'),
('550e8400-e29b-41d4-a716-446655440007', (SELECT id FROM course_offerings WHERE code = 'CSE 210' LIMIT 1), 'student', 'enrolled'),
('550e8400-e29b-41d4-a716-446655440008', (SELECT id FROM course_offerings WHERE code = 'CSE 210' LIMIT 1), 'student', 'enrolled'),
('550e8400-e29b-41d4-a716-446655440009', (SELECT id FROM course_offerings WHERE code = 'CSE 210' LIMIT 1), 'student', 'enrolled');
