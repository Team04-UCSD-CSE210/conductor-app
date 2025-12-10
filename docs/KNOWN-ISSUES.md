# Known Issues & Technical Debt

This document tracks known technical debt, frontend-backend disconnects, and planned improvements for the Conductor application.

**Last Updated**: December 10, 2025  
**Status**: Active tracking

---

## [CRITICAL] Critical Issues

### 1. Hardcoded Recent Progress in Dashboards

**Status**: [NOT FIXED]  
**Priority**: High  
**Affected Files**:
- `src/views/instructor-dashboard.html` (lines 130-152)
- `src/views/ta-dashboard.html` (lines 123-145)
- `src/views/tutor-dashboard.html` (lines 117-139)
- `src/views/student-dashboard.html` (lines 150-172)

**Problem**:
Most dashboards have hardcoded week data in HTML. Only the student leader dashboard (`student-leader-dashboard.js`) has dynamic loading from the backend via `loadRecentProgress()`.

**Solution**:
Copy the `loadRecentProgress()` function from `src/public/js/student-leader-dashboard.js` to:
- `src/public/js/instructor-dashboard.js`
- `src/public/js/ta-dashboard.js`
- `src/public/js/tutor-dashboard.js`
- `src/public/js/student-dashboard.js`

**API Endpoint**: Already exists (used by student leader dashboard)

---

### 2. Create Attendance Button - No Event Handler

**Status**: [NOT FIXED]  
**Priority**: Medium  
**Affected Files**:
- `src/views/ta-dashboard.html` (line 68)

**Problem**:
The "Create Attendance" button exists but has no JavaScript event handler:

```html
<button id="createAttendanceBtn" class="btn btn-primary btn-create-attendance" aria-label="Add attendance">+</button>
```

**Solution Options**:
1. Add event handler in `ta-dashboard.js` to open attendance creation modal
2. Remove the button if feature is not needed for TAs

**Decision Needed**: Should TAs be able to create attendance sessions?

---

## [MEDIUM PRIORITY] Medium Priority Issues

### 3. Hardcoded Dashboard Statistics

**Status**: [NOT FIXED]  
**Priority**: Medium

#### Student Dashboard (`student-dashboard.js` lines 55-68)
- [X] **Group Members**: Hardcoded to `0` (needs team members endpoint)
- [X] **Assignments Due**: Hardcoded to `0` (needs assignments endpoint)
- [X] **Weeks Left**: Hardcoded to `4` (placeholder value)

#### TA Dashboard (`ta-dashboard.js` lines 58-69)
- [X] **To Grade**: Hardcoded to `0` (needs assignments/grading endpoint)
- [!] **Teams Assigned**: Shows all teams, should be filtered by TA assignment

#### Tutor Dashboard (`tutor-dashboard.js` lines 65-74)
- [X] **To Grade**: Hardcoded to `0` (needs assignments/grading endpoint)
- [!] **Teams Assigned**: Shows all teams, should be filtered by tutor assignment

**Backend APIs Needed**:
1. `GET /api/teams/:teamId/members/count` - Team member count
2. `GET /api/assignments/:offeringId/due` - Upcoming assignments
3. `GET /api/offerings/:offeringId/weeks-remaining` - Calculate weeks left
4. `GET /api/teams/assigned/:userId` - Teams assigned to TA/tutor

---

### 4. Course Title Flash of Incorrect Content

**Status**: [!] Minor Issue  
**Priority**: Low  
**Affected Files**: All dashboard HTML files

**Problem**:
HTML contains hardcoded "CSE 210: Software Engineering":
```html
<h3>CSE 210: Software Engineering</h3>
```

JavaScript updates this via `updateStickyHeader()`, but shows wrong content initially.

**Solution**:
Use a placeholder or loading state in HTML:
```html
<h3 id="courseTitle" class="loading">Loading course information...</h3>
```

---

### 5. Course Description Placeholder

**Status**: [!] Minor Issue  
**Priority**: Low  
**Affected Files**: All dashboard HTML files

**Problem**:
Shows "Insert course description" as placeholder text initially:
```html
<p>Insert course description & team information</p>
```

**Solution**:
Same as above - use loading state or fetch immediately on page load.

---

## [FUTURE] Future Enhancements

### 6. Team Assignment Filtering for TAs/Tutors

**Status**: [PLANNED]  
**Priority**: Medium

**Current State**:
- TAs and tutors see all teams in the course
- No filtering based on which teams they're assigned to supervise

**Desired State**:
- TAs/tutors only see teams they're assigned to
- Requires new `team_assignments` table or extension of enrollment table

**Database Changes Needed**:
```sql
-- Option 1: New table
CREATE TABLE team_assignments (
  id UUID PRIMARY KEY,
  enrollment_id UUID REFERENCES enrollments(id),
  team_id UUID REFERENCES teams(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Option 2: Add to existing enrollments table
ALTER TABLE enrollments
ADD COLUMN assigned_teams UUID[] DEFAULT '{}';
```

---

### 7. Assignments & Grading System

**Status**: [PLANNED]  
**Priority**: High

**Current State**:
- Database tables exist (`assignments`, `submissions`, `grades`)
- No frontend UI implemented
- No backend API endpoints

**Needed Components**:
1. **Backend APIs**:
   - `POST /api/assignments` - Create assignment
   - `GET /api/assignments/:offeringId` - List assignments
   - `POST /api/submissions` - Submit assignment
   - `POST /api/grades` - Grade submission

2. **Frontend Pages**:
   - Assignment creation form (instructor/professor)
   - Assignment list view (all roles)
   - Submission interface (students)
   - Grading interface (TAs/tutors)

3. **Dashboard Integration**:
   - Show upcoming assignments
   - Display grading queue
   - Track submission status

---

### 8. Real-time Notifications

**Status**: [IDEA]  
**Priority**: Low

**Concept**:
Add real-time notifications for:
- New announcements
- Assignment due reminders
- Attendance session opening
- Grade releases

**Technology Options**:
- WebSockets (socket.io)
- Server-Sent Events (SSE)
- Polling (current approach)

---

## Technical Debt Summary

| Category | Count | Priority |
|----------|-------|----------|
| Critical Issues | 2 | [HIGH PRIORITY] |
| Medium Priority | 3 | [MEDIUM PRIORITY] |
| Minor Issues | 2 | [LOW PRIORITY] |
| Future Enhancements | 3 | [PLANNED] |
| **Total** | **10** | - |

---

## Quick Wins (Easy Fixes)

These issues can be resolved quickly with minimal effort:

1. [OK] **Copy loadRecentProgress() function** (1 hour)
   - Copy from student-leader-dashboard.js to 4 other dashboard files
   - Test on each dashboard

2. [OK] **Fix course title flash** (30 minutes)
   - Add loading state to HTML
   - Update CSS for loading animation

3. [OK] **Remove/implement Create Attendance button** (15 minutes)
   - Either add event handler or remove button

---

## Backend API Gaps

APIs that need to be implemented:

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/api/teams/:teamId/members/count` | GET | Count team members | Medium |
| `/api/assignments/:offeringId/due` | GET | Upcoming assignments | High |
| `/api/offerings/:offeringId/weeks-remaining` | GET | Weeks left calculation | Low |
| `/api/teams/assigned/:userId` | GET | Teams assigned to TA/tutor | Medium |
| `/api/assignments` | POST | Create assignment | High |
| `/api/submissions` | POST | Submit assignment | High |
| `/api/grades` | POST | Grade submission | High |

---

## Related Documentation

- [Frontend Overview](frontend/overview.md) - Frontend architecture
- [API Reference](backend/api-reference.md) - Current API endpoints
- [Database Schema](database/schema.md) - Database structure
- [Contributing Workflow](contributing/workflow.md) - How to contribute fixes

---

## How to Contribute

Found a bug or want to fix technical debt?

1. Check this document for known issues
2. Create a new branch: `fix/issue-name`
3. Implement the fix
4. Update this document to mark as [OK] Fixed
5. Submit a PR

See [Contributing Workflow](contributing/workflow.md) for detailed steps.

---

**Note**: This document should be updated whenever new technical debt is discovered or existing issues are resolved.
