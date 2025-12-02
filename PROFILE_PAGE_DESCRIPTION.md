# Profile Page Design Description

## Overview
The profile page will be a unified interface where all users can view and edit their personal information, with role-based additional sections. **Students, Team Leads, TAs, and Tutors** can edit their own profile. **Instructors** can edit both their profile and course information. **TAs** can form teams, assign team leads, and manage team information.

---

## Common Sections (All Roles)

### 1. Personal Information
- **Name** (required, editable)
- **Preferred Name** (optional, editable)
- **Email** (read-only, from OAuth)
- **Phone Number** (optional, editable)
- **Profile Photo** (via image_url upload)

### 2. Academic Information (Students/Team Leads Only)
- **Major** (optional)
- **Degree Program** (optional)
- **Academic Year** (optional)
- **Department** (optional)
- **Class Level** (optional)
- **Institution Type** (UCSD/Extension - read-only, auto-detected from email)

### 3. Professional Links (All Roles)
- **GitHub Username** (optional)
- **LinkedIn URL** (optional)
- **Profile URL** (optional)

### 4. Account Settings
- **Status** (active/busy/inactive) - visible to user
- **Primary Role** (read-only)
- **Account Creation Date** (read-only)

---

## Role-Specific Sections

### Students & Team Leads
**Personal Profile Only:**
- Can edit their own personal information, academic info, and professional links
- View-only sections:
  - Current enrollment (course code, role: student/team-lead, enrollment status)
  - Team membership (team name, team number, role: leader/member, team status)
  - Academic year

### TAs
**Personal Profile + Team Management:**

1. **Personal Profile** (editable - same as students)
   - All common sections above

2. **Team Management Section:**
   - **Create/Form New Teams:**
     - Form new teams for the course offering
     - Set team name and team number
     - Choose initial team status (forming/active/inactive)
   
   - **Assign Team Leads:**
     - Assign team lead from enrolled students
     - Change team lead for existing teams
     - View current team lead information
   
   - **Manage Existing Teams:**
     - List of all teams in the course offering with:
       - Team name and number
       - Team status (forming/active/inactive)
       - Current team lead (name and email)
       - Member list with names, emails, and roles
     - Edit controls for each team:
       - Update team name
       - Update team number
       - Change team status
       - Add/remove team members (with permission checks)
       - **Assign or change team leader**
       - View team history

### Tutors
**Personal Profile Only:**
- Can edit their own personal information and professional links
- No additional management sections (similar to students)

### Instructors
**Personal Profile + Course Management:**

1. **Personal Profile** (editable - same as above)
   - All common sections

2. **Course Management Section:**
   - **Course Details:**
     - Course code and name
     - Department
     - Term and year
     - Credits
     - Instructor assignment
   
   - **Schedule & Dates:**
     - Start date and end date
     - Enrollment cap
     - Course status (open/closed/completed)
     - Location
     - Class timings (JSONB structure for day/time)
   
   - **Course Materials:**
     - Syllabus URL
     - Color palette (theme customization)
   
   - **Course Settings:**
     - Active/inactive toggle
     - Enrollment status

---

## Layout Structure

### Header Section
- Profile photo (circular, top-left)
- User's name and preferred name
- Primary role badge (Student, TA, Tutor, Instructor)
- Edit mode toggle button (View/Edit)

### Navigation Tabs/Sections
1. **Profile** - Personal information (all roles)
2. **Academic Info** - Academic fields (students/team leads only)
3. **Team Management** - Team creation and management (TAs only)
4. **Course Settings** - Course management (instructors only)

### Form Layout
- Card-based sections for easy organization
- Inline editing where appropriate
- Save/Cancel buttons per section
- Validation messages inline
- Success/error notifications
- Permission-based visibility (edit controls only show if user has permission)

---

## Permission-Based Access

### Edit Permissions
- **Own Profile:** All authenticated users can edit their own profile
- **Course Details:** Only instructors (requires `course.manage` permission)
- **Team Details:** TAs can form teams, assign team leads, and edit teams they manage (requires team assignment or `team.manage` permission)
- **Enrollment:** Only instructors/admins (requires `roster.manage` or `course.manage`)

### View Permissions
- **Own Profile:** Always visible to the user
- **Course Details:** All enrolled users can view, but only instructors can edit
- **Team Details:** Team members can view their team; TAs can view and manage all teams

---

## Key Features

1. **Real-time Validation:**
   - Email format validation
   - URL format validation
   - Phone number format validation
   - Required field checks
   - Academic year range validation

2. **Image Upload:**
   - Profile photo upload functionality
   - Preview before saving
   - Image URL storage in database

3. **Team Management (TAs):**
   - **Form new teams** with team name and number
   - **Assign team leaders** from enrolled students
   - Add/remove team members
   - Change team leader for existing teams
   - Update team status
   - View team history and member changes

4. **Course Management (Instructors):**
   - Edit course metadata (code, name, department, term, year, credits)
   - Manage schedule (JSONB structure for class timings)
   - Update color palette
   - Toggle active status
   - Manage enrollment settings

5. **Audit Trail:**
   - Last updated timestamp
   - Updated by field (if applicable)
   - Change history (via activity_logs table)

---

## UI/UX Considerations

- **Responsive Design:** Mobile-friendly layout matching existing dashboard styles
- **Color Palette Integration:** Uses the active course's color palette (like other pages)
- **Accessibility:** ARIA labels, keyboard navigation, screen reader support
- **Loading States:** Skeleton screens while data loads
- **Error Handling:** Clear error messages, graceful failure handling
- **Confirmation Dialogs:** For destructive actions (removing team member, deactivating course)

---

## Technical Implementation Notes

### Backend Routes Needed:
- `GET /api/users/me` - Get current user's profile
- `PUT /api/users/me` - Update own profile (all authenticated users)
- `GET /api/teams?offering_id=:id` - Get all teams (TAs with permissions)
- `POST /api/teams` - Form/create new team (TA with permissions)
- `PUT /api/teams/:id` - Update team info (TA with permissions)
- `POST /api/teams/:id/members` - Add team member (TA)
- `DELETE /api/teams/:id/members/:userId` - Remove team member (TA)
- `PUT /api/teams/:id/leader` - Assign/change team leader (TA)
- `GET /api/offerings/:id` - Get course details (instructors)
- `PUT /api/offerings/:id` - Update course (instructor only)

### Permission Checks:
- Use existing `protect()` middleware from permission-middleware.js
- Verify `course.manage` permission for course edits
- Verify team assignment/permissions for team management
- Self-service for own profile edits

### Data Flow:
1. Load user data on page load
2. Load role-specific data (teams/course) based on permissions
3. Show/hide sections based on user role and permissions
4. Save changes with validation and permission checks
5. Update UI with success/error feedback

---

This structure aligns with your existing permission system and database schema while providing appropriate functionality for each role. **TAs have full team management capabilities including forming teams and assigning team leads**, while instructors manage course-level settings.


