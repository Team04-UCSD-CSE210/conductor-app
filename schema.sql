--
-- PostgreSQL database dump
--

\restrict 5qn2iCroU1HmzrulzQVVOuvfDVtpeBJjpHysenrfjLaxmj1YwaSeXxzewFiMtTk

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: activity_action_type_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.activity_action_type_enum AS ENUM (
    'login',
    'logout',
    'submit_assignment',
    'update_submission',
    'join_team',
    'leave_team',
    'grade_submission',
    'create_assignment',
    'update_assignment',
    'enroll',
    'drop'
);


ALTER TYPE public.activity_action_type_enum OWNER TO conductor_app_user;

--
-- Name: assignment_assigned_to_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.assignment_assigned_to_enum AS ENUM (
    'team',
    'individual'
);


ALTER TYPE public.assignment_assigned_to_enum OWNER TO conductor_app_user;

--
-- Name: assignment_type_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.assignment_type_enum AS ENUM (
    'project',
    'hw',
    'exam',
    'checkpoint'
);


ALTER TYPE public.assignment_type_enum OWNER TO conductor_app_user;

--
-- Name: attendance_status_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.attendance_status_enum AS ENUM (
    'present',
    'absent',
    'late',
    'excused'
);


ALTER TYPE public.attendance_status_enum OWNER TO conductor_app_user;

--
-- Name: course_offering_status_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.course_offering_status_enum AS ENUM (
    'open',
    'closed',
    'completed'
);


ALTER TYPE public.course_offering_status_enum OWNER TO conductor_app_user;

--
-- Name: course_role_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.course_role_enum AS ENUM (
    'student',
    'ta',
    'tutor'
);


ALTER TYPE public.course_role_enum OWNER TO conductor_app_user;

--
-- Name: enrollment_status_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.enrollment_status_enum AS ENUM (
    'enrolled',
    'waitlisted',
    'dropped',
    'completed'
);


ALTER TYPE public.enrollment_status_enum OWNER TO conductor_app_user;

--
-- Name: institution_type_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.institution_type_enum AS ENUM (
    'ucsd',
    'extension'
);


ALTER TYPE public.institution_type_enum OWNER TO conductor_app_user;

--
-- Name: submission_status_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.submission_status_enum AS ENUM (
    'draft',
    'submitted',
    'graded'
);


ALTER TYPE public.submission_status_enum OWNER TO conductor_app_user;

--
-- Name: team_member_role_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.team_member_role_enum AS ENUM (
    'leader',
    'member'
);


ALTER TYPE public.team_member_role_enum OWNER TO conductor_app_user;

--
-- Name: team_status_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.team_status_enum AS ENUM (
    'forming',
    'active',
    'inactive'
);


ALTER TYPE public.team_status_enum OWNER TO conductor_app_user;

--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.user_role_enum AS ENUM (
    'admin',
    'instructor',
    'student'
);


ALTER TYPE public.user_role_enum OWNER TO conductor_app_user;

--
-- Name: user_status_enum; Type: TYPE; Schema: public; Owner: conductor_app_user
--

CREATE TYPE public.user_status_enum AS ENUM (
    'active',
    'busy',
    'inactive'
);


ALTER TYPE public.user_status_enum OWNER TO conductor_app_user;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: conductor_app_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    -- Preserve created_by and created_at
    IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME != 'users' THEN
            NEW.created_by = OLD.created_by;
        END IF;
        NEW.created_at = OLD.created_at;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO conductor_app_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: conductor_app_user
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    offering_id uuid,
    action_type public.activity_action_type_enum NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_logs OWNER TO conductor_app_user;

--
-- Name: TABLE activity_logs; Type: COMMENT; Schema: public; Owner: conductor_app_user
--

COMMENT ON TABLE public.activity_logs IS 'Audit trail of all user actions';


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: conductor_app_user
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid NOT NULL,
    title text NOT NULL,
    type public.assignment_type_enum NOT NULL,
    due_date timestamp with time zone NOT NULL,
    late_policy jsonb,
    max_points numeric,
    rubric jsonb,
    assigned_to public.assignment_assigned_to_enum,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE public.assignments OWNER TO conductor_app_user;

--
-- Name: TABLE assignments; Type: COMMENT; Schema: public; Owner: conductor_app_user
--

COMMENT ON TABLE public.assignments IS 'Course assignments (projects, homework, exams, checkpoints)';


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: conductor_app_user
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    status public.attendance_status_enum NOT NULL,
    marked_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.attendance OWNER TO conductor_app_user;

--
-- Name: TABLE attendance; Type: COMMENT; Schema: public; Owner: conductor_app_user
--

COMMENT ON TABLE public.attendance IS 'Tracks student attendance for each class date';


--
-- Name: course_offerings; Type: TABLE; Schema: public; Owner: conductor_app_user
--

CREATE TABLE public.course_offerings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    department text,
    term text,
    year integer,
    credits integer,
    instructor_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    enrollment_cap integer,
    status public.course_offering_status_enum,
    location text,
    class_timings jsonb,
    syllabus_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE public.course_offerings OWNER TO conductor_app_user;

--
-- Name: TABLE course_offerings; Type: COMMENT; Schema: public; Owner: conductor_app_user
--

COMMENT ON TABLE public.course_offerings IS 'Course information - typically one row for single-course app';


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: conductor_app_user
--

CREATE TABLE public.enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid NOT NULL,
    user_id uuid NOT NULL,
    course_role public.course_role_enum NOT NULL,
    status public.enrollment_status_enum NOT NULL,
    enrolled_at date,
    dropped_at date,
    final_grade text,
    grade_marks numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE public.enrollments OWNER TO conductor_app_user;

--
-- Name: TABLE enrollments; Type: COMMENT; Schema: public; Owner: conductor_app_user
--

COMMENT ON TABLE public.enrollments IS 'Links users to courses with their role and status. Stores final course grade (computed from assignment submissions).';


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: conductor_app_user
--

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    user_id uuid,
    team_id uuid,
    submitted_at timestamp with time zone,
    status public.submission_status_enum NOT NULL,
    score numeric,
    feedback text,
    files jsonb,
    graded_by uuid,
    graded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT submission_owner CHECK ((((team_id IS NULL) AND (user_id IS NOT NULL)) OR ((team_id IS NOT NULL) AND (user_id IS NULL))))
);


ALTER TABLE public.submissions OWNER TO conductor_app_user;

--
-- Name: TABLE submissions; Type: COMMENT; Schema: public; Owner: conductor_app_user
--

COMMENT ON TABLE public.submissions IS 'Tracks student/team submissions and grades';


--
-- Name: team; Type: TABLE; Schema: public; Owner: conductor_app_user
--

CREATE TABLE public.team (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offering_id uuid NOT NULL,
    name text NOT NULL,
    team_number integer,
    leader_id uuid,
    status public.team_status_enum,
    formed_at date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE public.team OWNER TO conductor_app_user;

--
-- Name: TABLE team; Type: COMMENT; Schema: public; Owner: conductor_app_user
--

COMMENT ON TABLE public.team IS 'Student teams within the course';


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: conductor_app_user
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.team_member_role_enum,
    joined_at date,
    left_at date,
    removed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE public.team_members OWNER TO conductor_app_user;

--
-- Name: TABLE team_members; Type: COMMENT; Schema: public; Owner: conductor_app_user
--

COMMENT ON TABLE public.team_members IS 'Team membership records';


--
-- Name: users; Type: TABLE; Schema: public; Owner: conductor_app_user
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email public.citext NOT NULL,
    ucsd_pid text,
    name text NOT NULL,
    preferred_name text,
    major text,
    degree_program text,
    academic_year integer,
    department text,
    class_level text,
    primary_role public.user_role_enum NOT NULL,
    status public.user_status_enum NOT NULL,
    institution_type public.institution_type_enum,
    profile_url text,
    image_url text,
    phone_number text,
    github_username text,
    linkedin_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    deleted_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO conductor_app_user;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: conductor_app_user
--

COMMENT ON TABLE public.users IS 'Stores all people: admin, instructor, TA, and students';


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_offering_id_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_offering_id_user_id_date_key UNIQUE (offering_id, user_id, date);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: course_offerings course_offerings_code_term_year_key; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.course_offerings
    ADD CONSTRAINT course_offerings_code_term_year_key UNIQUE (code, term, year);


--
-- Name: course_offerings course_offerings_pkey; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.course_offerings
    ADD CONSTRAINT course_offerings_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_offering_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_offering_id_user_id_key UNIQUE (offering_id, user_id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: team team_pkey; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_action_type; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_activity_logs_action_type ON public.activity_logs USING btree (action_type);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);


--
-- Name: idx_activity_logs_offering; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_activity_logs_offering ON public.activity_logs USING btree (offering_id);


--
-- Name: idx_activity_logs_user; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_activity_logs_user ON public.activity_logs USING btree (user_id);


--
-- Name: idx_assignments_created_by; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_assignments_created_by ON public.assignments USING btree (created_by);


--
-- Name: idx_assignments_due_date; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_assignments_due_date ON public.assignments USING btree (due_date);


--
-- Name: idx_assignments_offering; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_assignments_offering ON public.assignments USING btree (offering_id);


--
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_attendance_date ON public.attendance USING btree (date);


--
-- Name: idx_attendance_offering; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_attendance_offering ON public.attendance USING btree (offering_id);


--
-- Name: idx_attendance_status; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_attendance_status ON public.attendance USING btree (status);


--
-- Name: idx_attendance_user; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_attendance_user ON public.attendance USING btree (user_id);


--
-- Name: idx_course_offerings_active; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_course_offerings_active ON public.course_offerings USING btree (is_active);


--
-- Name: idx_course_offerings_created_by; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_course_offerings_created_by ON public.course_offerings USING btree (created_by);


--
-- Name: idx_course_offerings_instructor; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_course_offerings_instructor ON public.course_offerings USING btree (instructor_id);


--
-- Name: idx_enrollments_course_role; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_enrollments_course_role ON public.enrollments USING btree (course_role);


--
-- Name: idx_enrollments_created_by; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_enrollments_created_by ON public.enrollments USING btree (created_by);


--
-- Name: idx_enrollments_offering; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_enrollments_offering ON public.enrollments USING btree (offering_id);


--
-- Name: idx_enrollments_user; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_enrollments_user ON public.enrollments USING btree (user_id);


--
-- Name: idx_submissions_assignment; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_submissions_assignment ON public.submissions USING btree (assignment_id);


--
-- Name: idx_submissions_graded_by; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_submissions_graded_by ON public.submissions USING btree (graded_by);


--
-- Name: idx_submissions_status; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_submissions_status ON public.submissions USING btree (status);


--
-- Name: idx_submissions_team; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_submissions_team ON public.submissions USING btree (team_id);


--
-- Name: idx_submissions_user; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_submissions_user ON public.submissions USING btree (user_id);


--
-- Name: idx_team_created_by; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_team_created_by ON public.team USING btree (created_by);


--
-- Name: idx_team_leader; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_team_leader ON public.team USING btree (leader_id);


--
-- Name: idx_team_members_created_by; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_team_members_created_by ON public.team_members USING btree (created_by);


--
-- Name: idx_team_members_team; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_team_members_team ON public.team_members USING btree (team_id);


--
-- Name: idx_team_members_user; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_team_members_user ON public.team_members USING btree (user_id);


--
-- Name: idx_team_offering; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_team_offering ON public.team USING btree (offering_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_primary_role; Type: INDEX; Schema: public; Owner: conductor_app_user
--

CREATE INDEX idx_users_primary_role ON public.users USING btree (primary_role);


--
-- Name: assignments update_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: conductor_app_user
--

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendance update_attendance_updated_at; Type: TRIGGER; Schema: public; Owner: conductor_app_user
--

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: course_offerings update_course_offerings_updated_at; Type: TRIGGER; Schema: public; Owner: conductor_app_user
--

CREATE TRIGGER update_course_offerings_updated_at BEFORE UPDATE ON public.course_offerings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: enrollments update_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: conductor_app_user
--

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: submissions update_submissions_updated_at; Type: TRIGGER; Schema: public; Owner: conductor_app_user
--

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: team_members update_team_members_updated_at; Type: TRIGGER; Schema: public; Owner: conductor_app_user
--

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: team update_team_updated_at; Type: TRIGGER; Schema: public; Owner: conductor_app_user
--

CREATE TRIGGER update_team_updated_at BEFORE UPDATE ON public.team FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: conductor_app_user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE;


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: assignments assignments_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: attendance attendance_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.users(id);


--
-- Name: attendance attendance_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: course_offerings course_offerings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.course_offerings
    ADD CONSTRAINT course_offerings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: course_offerings course_offerings_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.course_offerings
    ADD CONSTRAINT course_offerings_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.users(id);


--
-- Name: course_offerings course_offerings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.course_offerings
    ADD CONSTRAINT course_offerings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: enrollments enrollments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: enrollments enrollments_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: enrollments enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.users(id);


--
-- Name: submissions submissions_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.team(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: submissions submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: team team_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: team team_leader_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_leader_id_fkey FOREIGN KEY (leader_id) REFERENCES public.users(id);


--
-- Name: team_members team_members_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: team_members team_members_removed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_removed_by_fkey FOREIGN KEY (removed_by) REFERENCES public.users(id);


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.team(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: team team_offering_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_offering_id_fkey FOREIGN KEY (offering_id) REFERENCES public.course_offerings(id) ON DELETE CASCADE;


--
-- Name: team team_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: users users_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: conductor_app_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO conductor_app_user;


--
-- PostgreSQL database dump complete
--

\unrestrict 5qn2iCroU1HmzrulzQVVOuvfDVtpeBJjpHysenrfjLaxmj1YwaSeXxzewFiMtTk

