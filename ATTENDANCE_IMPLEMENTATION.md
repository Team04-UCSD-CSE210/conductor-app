# Attendance Feature Implementation Summary

## ✅ Completed Components

### 1. Database Schema

Updated `migrations/01-create-tables.sql` with new tables:

- **sessions** - Class sessions with unique access codes
- **session_questions** - Questions for each session
- **session_responses** - Student responses to questions
- **attendance** - Student attendance tracking per session

**New Migration (Sprint 3):**

- `migrations/11-add-team-id-to-sessions.sql` - Added `team_id` column to sessions table
  - Enables team-specific sessions (team meetings) vs course-wide sessions (lectures)
  - Nullable foreign key to `team` table with CASCADE delete
  - Index on `team_id` for performance
  - Instructors create course-wide sessions (team_id = NULL)
  - Team leaders create team-specific sessions (team_id = their team UUID)

### 2. Backend - Models (Data Layer)

Created 4 model files with CRUD operations:

- `src/models/session-model.js` - Session management
  - **Updated (Sprint 3)**: Added `team_id` support in `create()` method
  - **New method**: `findByOfferingIdWithTeamFilter(offeringId, userTeamIds, options)` -
    Filters sessions based on team membership
  - **Updated**: Added `team_id` to allowed update fields
- `src/models/session-question-model.js` - Question management
- `src/models/session-response-model.js` - Response management
- `src/models/attendance-model.js` - Attendance tracking

### 3. Backend - Services (Business Logic)

Created 2 service files with business logic:

- `src/services/session-service.js` - Session operations, code generation, validation
  - **Updated (Sprint 3)**: Auto-detects and sets `team_id` when team leaders create sessions
  - **Updated**: `getSessionsByOffering()` now accepts `userId` parameter for team-based filtering
  - **New helper**: `_batchAutoOpenSessions()` - Extracted auto-open logic for code reusability
  - **Logic**: Instructors create course-wide sessions (team_id = NULL), team leaders create team
    sessions (team_id auto-set)
- `src/services/attendance-service.js` - Attendance tracking, statistics, check-in logic

### 4. Backend - API Routes

Created 2 route files with REST API endpoints:

- `src/routes/session-routes.js` - 16 session management endpoints
  - **Updated (Sprint 3)**: GET `/api/sessions` now passes `req.currentUser.id` to enable team filtering
  - Students see: course-wide lectures (team_id = NULL) + their team's meetings
  - Instructors see: all sessions (no filtering applied)
- `src/routes/attendance-routes.js` - 15 attendance tracking endpoints

### 5. Backend - Integration

- Updated `src/server.js` to register new routes (`/api/sessions`, `/api/attendance`)
- Added frontend routes in `src/server.js` for all attendance pages

### 6. Frontend - Views (HTML Pages)

Created 5 HTML pages for attendance features:

- `src/views/instructor-lectures.html` - Instructor view of all lectures
- `src/views/lecture-builder.html` - Create new lecture sessions with questions
- `src/views/lecture-responses.html` - View student responses for a lecture
- `src/views/lecture-attendance-student.html` - Student check-in page with access code
- `src/views/student-lecture-response.html` - Student response form for lecture questions

### 7. Frontend - JavaScript Files

Created 6 JavaScript files for frontend functionality:

- `src/public/js/lecture-data.service.js` - Data service for lecture API calls
- `src/public/js/instructor-lecture-overview.js` - Instructor lectures overview logic
- `src/public/js/instructor-lecture-form.js` - Lecture creation/editing form logic
- `src/public/js/instructor-lecture-detail.js` - Individual lecture detail view
- `src/public/lecture-attendance-student.js` - Student check-in page logic
- `src/public/js/student-lecture-response.js` - Student response form logic

### 8. Frontend - CSS Styles

Created 4 CSS files for styling:

- `src/public/instructor-lectures.css` - Instructor lectures page styling
- `src/public/lecture-builder.css` - Lecture builder form styling
- `src/public/lecture-responses.css` - Lecture responses view styling
- `src/public/lecture-attendance-student.css` - Student check-in page styling
- `src/public/student-lecture-response.css` - Student response form styling

### 9. Backend - Tests

**Comprehensive Test Coverage (Sprint 3 Update):**

Existing test suites:

- `src/tests/attendance.test.js` - 20 tests for attendance functionality
- `src/tests/session-model.test.js` - 20 tests for SessionModel CRUD operations
- `src/tests/session-routes.test.js` - Tests for HTTP endpoints and authorization
- `src/tests/session-ownership.test.js` - 17 tests for session ownership and authorization
- `src/tests/team-leader-permissions.test.js` - 11 tests for team leader permission resolution

**New Comprehensive Test Suites (Sprint 3):**

- **`src/tests/session-team-filtering.test.js`** - 21 tests covering:
  - Team ID auto-detection (instructors vs team leaders)
  - Session visibility filtering (course-wide vs team-specific)
  - Team membership-based access control
  - Edge cases (multiple teams, no team, referential integrity)
  - Performance testing for filtering queries

- **`src/tests/session-service-comprehensive.test.js`** - 39 tests covering:
  - Access code generation (uniqueness, collision handling, retries)
  - Session creation (all scenarios, authorization, validation)
  - Attendance management (open/close/reopen)
  - Access code verification (valid/invalid/expired/inactive)
  - Auto-opening logic based on session_date and session_time
  - Concurrent operations and race conditions
  - Error handling for various failure scenarios
  - Session retrieval with filtering and pagination

- **`src/tests/session-edge-cases.test.js`** - 36 tests covering:
  - Boundary values (255-char titles, max lengths, date/time limits)
  - Invalid inputs (malformed dates, SQL injection attempts)
  - Unicode and special character handling
  - Null/undefined handling for required fields
  - Concurrent operations (access codes, updates, attendance)
  - Timezone and daylight saving time handling
  - Resource management and database connection errors
  - Data integrity (foreign keys, cascading deletes, unique constraints)
  - Access code edge cases (empty, case sensitivity)

**Test Results:**

- ✅ **17 test files passing**
- ✅ **338 tests passed, 1 skipped**
- ✅ **Zero test failures**
- ⏱️ **Execution time: ~10.45s**

**Removed Redundancies:**

- Deleted `src/tests/session.test.js` (duplicate coverage with session-model.test.js)

## 📋 Frontend Routes

### Instructor Routes

All instructor routes require authentication and appropriate permissions:

1. **`GET /instructor-lectures`**
   - **Purpose**: View all lecture sessions and manage attendance
   - **Permissions**: `attendance.view`, `session.manage`, or `course.manage` (course scope)
   - **Access**: Instructors, TAs, Admins
   - **View**: `src/views/instructor-lectures.html`
   - **JavaScript**: `src/public/js/instructor-lecture-overview.js`, `src/public/js/instructor-lecture-detail.js`
   - **CSS**: `src/public/instructor-lectures.css`
   - **Features**:
     - View all lecture sessions
     - See attendance statistics
     - Access individual lecture details
     - Open/close attendance sessions

2. **`GET /lecture-builder`**
   - **Purpose**: Create new lecture attendance sessions with questions
   - **Permissions**: `session.create`, `session.manage`, or `course.manage` (course scope)
   - **Access**: Instructors, Admins
   - **View**: `src/views/lecture-builder.html`
   - **JavaScript**: `src/public/js/instructor-lecture-form.js`
   - **CSS**: `src/public/lecture-builder.css`
   - **Features**:
     - Create new lecture sessions
     - Add questions (multiple choice, text, pulse check)
     - Set lecture date/time
     - Generate access codes
     - Auto-save functionality

3. **`GET /lecture-responses`**
   - **Purpose**: View student responses for lecture sessions
   - **Permissions**: `attendance.view`, `session.manage`, or `course.manage` (course scope)
   - **Access**: Instructors, TAs, Admins
   - **View**: `src/views/lecture-responses.html`
   - **CSS**: `src/public/lecture-responses.css`
   - **Features**:
     - View all student responses
     - Analyze response data
     - Export response data

### Student Routes

All student routes require authentication:

1. **`GET /lecture-attendance-student`**
   - **Purpose**: Students check in to lectures using access codes
   - **Permissions**: Authentication required (student role)
   - **Access**: Students, Instructors (for testing), Admins
   - **View**: `src/views/lecture-attendance-student.html`
   - **JavaScript**: `src/public/lecture-attendance-student.js`
   - **CSS**: `src/public/lecture-attendance-student.css`
   - **Features**:
     - Enter 6-digit access code
     - Check in to lecture
     - View attendance status
     - See lecture information

2. **`GET /student-lecture-response`**
   - **Purpose**: Students respond to lecture questions after checking in
   - **Permissions**: Authentication required (student role)
   - **Access**: Students, Instructors (for testing), Admins
   - **View**: `src/views/student-lecture-response.html`
   - **JavaScript**: `src/public/js/student-lecture-response.js`
   - **CSS**: `src/public/student-lecture-response.css`
   - **Features**:
     - Answer lecture questions (text, multiple choice, pulse check)
     - Submit responses
     - View submitted responses
     - Reset form functionality
     - Success confirmation

### Shared Frontend Files

- `src/public/js/lecture-data.service.js` - Shared data service for API communication
- `src/public/dashboard-global.css` - Shared dashboard styling
- `src/public/global.css` - Global application styles

## 📋 Backend API Endpoints

### Session Management (16 endpoints)

**Professor/Instructor:**

- `POST /api/sessions` - Create new session (requires `session.create` permission)
  - **Updated (Sprint 3)**: Auto-sets `team_id` if creator is a team leader
  - Instructors create course-wide sessions (team_id = NULL)
  - Team leaders create team-specific sessions (team_id = their team UUID)
- `GET /api/sessions?offering_id=<uuid>` - List sessions for course (authenticated)
  - **Updated (Sprint 3)**: Filters sessions based on user's team membership
  - Returns: course-wide sessions (team_id = NULL) + user's team sessions
  - Instructors see all sessions (no team filtering applied)
- `GET /api/sessions/:sessionId` - Get session details (authenticated)
- `PUT /api/sessions/:sessionId` - Update session (requires `session.manage` permission)
- `DELETE /api/sessions/:sessionId` - Delete session (requires `session.manage` permission)
- `GET /api/sessions/verify-code/:code` - Verify access code (authenticated)
- `POST /api/sessions/:sessionId/open-attendance` - Open attendance (requires `session.manage` permission)
- `POST /api/sessions/:sessionId/close-attendance` - Close attendance (requires `session.manage` permission)
- `POST /api/sessions/:sessionId/regenerate-code` - Regenerate access code
  (requires `session.manage` permission)
- `POST /api/sessions/:sessionId/questions` - Add questions (requires `session.manage` permission)
- `GET /api/sessions/:sessionId/questions` - Get questions (authenticated)
- `PUT /api/sessions/questions/:questionId` - Update question (requires `session.manage` permission)
- `DELETE /api/sessions/questions/:questionId` - Delete question (requires `session.manage` permission)
- `GET /api/sessions/:sessionId/responses` - View all responses
  (requires `session.manage` or `attendance.view` permission)
- `GET /api/sessions/:sessionId/statistics` - Get statistics
  (requires `session.manage` or `attendance.view` permission)

**Students:**

- `POST /api/sessions/questions/:questionId/responses` - Submit response (authenticated)
- `GET /api/sessions/:sessionId/my-responses` - Get my responses (authenticated)

### Attendance Management (15 endpoints)

**Students:**

- `POST /api/attendance/check-in` - Check in with access code (authenticated)
- `POST /api/attendance/sessions/:sessionId/responses` - Submit responses (authenticated)
- `GET /api/attendance/my-attendance?offering_id=<uuid>` - Get my attendance (authenticated)
- `GET /api/attendance/my-statistics/:offeringId` - Get my statistics (authenticated)

**Professor/Instructor/TA:**

- `GET /api/attendance/sessions/:sessionId` - Get session attendance (requires `attendance.view` permission)
- `GET /api/attendance/sessions/:sessionId/statistics` - Get statistics (requires `attendance.view` permission)
- `GET /api/attendance/sessions/:sessionId/report` - Get detailed report
  (requires `attendance.view` permission)
- `POST /api/attendance/mark` - Manually mark attendance (requires `attendance.mark` permission)
- `PUT /api/attendance/:attendanceId` - Update attendance status (requires `attendance.mark` permission)
- `DELETE /api/attendance/:attendanceId` - Delete attendance record (requires `attendance.mark` permission)
- `GET /api/attendance/student/:userId` - Get student's attendance (requires `attendance.view` permission)
- `GET /api/attendance/student/:userId/statistics/:offeringId` - Get student stats
  (requires `attendance.view` permission)
- `GET /api/attendance/course/:offeringId/summary` - Get course summary (requires `attendance.view` permission)
- `POST /api/attendance/sessions/:sessionId/close-and-mark-absent` - Close and mark absent
  (requires `attendance.mark` permission)
- `POST /api/attendance/bulk-import/:sessionId` - Bulk import attendance
  (requires `attendance.mark` permission)

## 🔑 Key Features

### Access Code System

- Auto-generated 6-character unique codes
- Code expiration support
- Code validation and verification
- Regenerate code functionality
- SQL injection prevention
- Case-sensitive validation

### Team-Based Session Isolation (Sprint 3)

**Course-Wide Sessions (Lectures):**

- Created by instructors
- `team_id = NULL` in database
- Visible to all students enrolled in the course
- Examples: Regular lectures, exams, course-wide announcements

**Team-Specific Sessions (Team Meetings):**

- Created by team leaders
- `team_id` automatically set to team leader's team UUID
- Visible only to members of that specific team
- Examples: Team standups, sprint retrospectives, team check-ins
- Maintains isolation between teams (Team A cannot see Team B's meetings)

**Filtering Logic:**

- Students see: `WHERE team_id IS NULL OR team_id IN (user's team IDs)`
- Instructors see: All sessions (no filtering)
- Team leaders see: Course-wide + their team's sessions
- Supports multiple team memberships per user

**Auto-Detection:**

- When team leader creates session → `team_id` auto-set
- When instructor creates session → `team_id` stays NULL
- Can manually override `team_id` during creation or update

### Session Management

- Create sessions with title, date, time
- Add multiple question types (text, multiple choice, pulse check)
- Open/close attendance windows
- Track session statistics (attendance %, response counts)

### Attendance Tracking

- Student check-in with access code
- Automatic status (present/late based on time)
- Manual attendance marking
- Bulk import support
- Auto-mark absent students when closing

### Question & Response System

- Text entry questions
- Multiple choice questions
- Pulse check questions
- Real-time response tracking
- Response statistics and aggregation

### Statistics & Reporting

- Session-level: attendance %, present/absent/late counts
- Student-level: individual attendance history and %
- Course-level: overall attendance summary for all students
- Response analytics: question-by-question breakdown

## 🔒 Permissions

Required permissions (implemented via RBAC system):

**Session Permissions:**

- `session.create` - Create sessions (Instructors, Team Leaders via team role)
- `session.manage` - Manage sessions (Instructors, Team Leaders for their sessions)
- `session.view` - View session details (All authenticated users)

**Attendance Permissions:**

- `attendance.view` - View attendance records (Instructors, TAs)
- `attendance.mark` - Mark attendance manually (Instructors, TAs)

**Team Permissions (Sprint 3):**

- `team.manage` - Manage team (Team Leaders)
- `team.view_all` - View all teams in course (Instructors, Admins)

**Permission Resolution:**

- Team leaders get `session.create` and `session.manage` via `team_role_permissions` table
- Team-specific sessions enforce ownership (only team leader of that team can manage)
- Course-wide permissions checked via `course_role_permissions` table

## 🧪 Testing

Comprehensive test coverage (338 passing tests) includes:

**Core Functionality:**

- Model CRUD operations (create, read, update, delete)
- Service business logic and validation
- Access code generation and uniqueness validation
- Check-in flow with various scenarios
- Response submission and retrieval
- Statistics calculation and aggregation
- Bulk operations and batch processing
- Error handling and edge cases

**Team-Based Features (Sprint 3):**

- Team ID auto-detection for session creation
- Session visibility filtering based on team membership
- Team leader authorization checks
- Permission resolution via team roles
- Multiple team membership scenarios
- Referential integrity with team deletion

**Edge Cases & Security:**

- SQL injection prevention (parameterized queries)
- Unicode character support in titles/descriptions
- Boundary value testing (max lengths, date/time limits)
- Null/undefined handling for all fields
- Concurrent operation handling (race conditions)
- Timezone and daylight saving time edge cases
- Database connection error handling
- Resource cleanup and memory leak prevention
- Access code collision and retry logic
- Case sensitivity validation

**Performance Testing:**

- Large batch operations (50+ sessions)
- Query optimization with team filtering
- Index usage verification
- Concurrent access code generation (20+ simultaneous)

## 🚀 Navigation Flow

### For Instructors

1. Login → `/faculty-dashboard` (auto-routed from `/dashboard`)
2. Navigate to `/instructor-lectures` to view all lectures
3. Click "New Lecture Attendance" → `/lecture-builder` to create a session
4. View responses at `/lecture-responses` (accessible from lecture detail view)
5. Manage attendance: open/close sessions, view statistics, mark manually

### For Students

1. Login → `/student-dashboard` (auto-routed from `/dashboard`)
2. Navigate to `/lecture-attendance-student` to check in with access code
3. After check-in, go to `/student-lecture-response` to answer questions
4. View attendance history and statistics

## 🔐 Permission System

The application uses a permission-based access control system:

### Permission Types

- **Global Permissions**: Apply system-wide (e.g., `user.manage`)
- **Course Permissions**: Apply to specific course offerings (e.g., `attendance.view`, `session.manage`)

### Required Permissions for Attendance Features

- `session.create` - Create new lecture sessions (Professor only)
- `session.manage` - Manage existing sessions (edit, delete, open/close) (Professor/TA)
- `attendance.view` - View attendance records (Professor/TA)
- `attendance.mark` - Mark attendance manually (Professor/TA)
- `course.manage` - Full course management (includes all above)

### Role-Based Access

- **Admin**: Has all permissions globally
- **Instructor**: Has course-level permissions for their courses
- **TA/Tutor**: Has limited course-level permissions (view attendance, view responses)
- **Student**: Can only check in and respond to questions

## 🚀 Getting Started

### 1. Run Migration

Apply database schema changes:

   ```bash
   psql $DATABASE_URL < migrations/01-create-tables.sql
   ```

### 2. Start the Server

```bash
npm start
```

Access the application:

- **HTTPS** (if SSL certificates are available): `https://localhost:8443`
- **HTTP** (fallback): `http://localhost:8080`

### 3. Run Tests

Verify all functionality:

   ```bash
   npm test tests/session.test.js
   npm test tests/attendance.test.js
   ```

### 4. Configure Permissions

Configure in permission system:

- Add `session.create`, `session.manage`, `attendance.view`, `attendance.mark`
- Assign to appropriate roles (professor, TA, student)

### 5. Access Routes

- Instructor routes: `/instructor-lectures`, `/lecture-builder`, `/lecture-responses`
- Student routes: `/lecture-attendance-student`, `/student-lecture-response`

## 🎨 Frontend Features

### Instructor Features

- ✅ Create lecture sessions with multiple question types
- ✅ View all lecture sessions with statistics
- ✅ Open/close attendance windows
- ✅ Regenerate access codes
- ✅ View student responses
- ✅ View attendance reports and statistics
- ✅ Manually mark attendance
- ✅ Bulk import attendance
- ✅ Auto-save lecture forms

### Student Features

- ✅ Check in with 6-digit access code
- ✅ Answer multiple question types (text, multiple choice, pulse check)
- ✅ Submit responses
- ✅ View submitted responses
- ✅ View attendance history and statistics
- ✅ Reset form functionality
- ✅ Success confirmations

## 🚀 Optional Enhancements

- WebSocket for real-time attendance updates
- QR code generation for access codes
- Email notifications for missed attendance
- Export attendance to CSV
- Attendance trends and analytics dashboard
- Mobile-responsive improvements

## 📝 Example Usage

### Professor creates a session

```javascript
POST /api/sessions
{
  "offering_id": "uuid",
  "title": "Lecture 5: Database Design",
  "description": "Introduction to normalization",
  "session_date": "2025-02-01",
  "session_time": "10:00:00",
  "questions": [
    {
      "question_text": "What did you learn today?",
      "question_type": "text",
      "is_required": true
    }
  ]
}
// Returns: { id, access_code: "ABC123", ... }
```

### Student checks in

```javascript
POST /api/attendance/check-in
{
  "access_code": "ABC123",
  "responses": [
    {
      "question_id": "uuid",
      "response_text": "I learned about database normalization"
    }
  ]
}
// Returns: { attendance: {...}, responses: [...] }
```

### Professor views attendance

```javascript
GET /api/attendance/sessions/:sessionId/report
// Returns: { session, report: [{ student, attendance, responses }], statistics }
```

## 🎯 Alignment with Requirements

✅ Sessions for different dates with unique codes  
✅ Professor provides code to students  
✅ Students login and attend with code  
✅ Students write responses to questions  
✅ Professor can see student answers  
✅ Attendance tracking (present/absent/late/excused)  
✅ 85% attendance calculation  
✅ Multiple question types  
✅ Real-time statistics  

## ✅ Implementation Status

### Backend: ✅ Complete (Sprint 3 Enhanced)

- ✅ Database schema (11 migrations total)
- ✅ Models (4 files, enhanced with team filtering)
- ✅ Services (2 files, team auto-detection logic)
- ✅ API Routes (2 files, 31 endpoints total with team filtering)
- ✅ Server integration
- ✅ **Comprehensive test coverage (338 passing tests across 17 test files)**

### Frontend: ✅ Complete

- ✅ HTML Views (5 pages)
- ✅ JavaScript (6 files)
- ✅ CSS Styling (5 files)
- ✅ Shared components
- ✅ UI/UX polished and consistent

### Features: ✅ Complete (Sprint 3 Enhanced)

- ✅ Access code system with security hardening
- ✅ Session management with team isolation
- ✅ Attendance tracking
- ✅ Question & response system
- ✅ Statistics & reporting
- ✅ Permission-based access control via RBAC
- ✅ **Team-based session filtering (NEW)**
- ✅ **Auto-detection of team leaders (NEW)**
- ✅ **Course-wide vs team-specific session types (NEW)**

### Testing: ✅ Complete (Sprint 3)

- ✅ **17 test files passing**
- ✅ **338 tests (21 + 39 + 36 new comprehensive tests)**
- ✅ **Zero failures**
- ✅ Edge case coverage (boundary values, SQL injection, concurrency)
- ✅ Performance testing
- ✅ Security validation

All backend and frontend components are complete, tested, and production-ready! 🎉

### Sprint 3 Enhancements Summary

**Database Layer:**

- Added `team_id` column to sessions table (nullable FK)
- Indexed for query performance

**Business Logic:**

- Auto-detection: Team leaders → team sessions, Instructors → course-wide
- Filtering: Users see course-wide + their team's sessions
- Permission enforcement: Team leaders can only manage their team's sessions

**Testing:**

- 96 new comprehensive tests added
- Removed 1 redundant test file
- All edge cases covered (SQL injection, concurrency, boundary values)
- Performance validated (batch operations, concurrent access)
