# Conductor App API Documentation

**Base URL**: `https://localhost:8443`

All endpoints require authentication unless otherwise noted.

---

## Table of Contents

1. [Health & Status](#health--status)
2. [User Management](#user-management)
3. [Roster Management](#roster-management)
4. [Authentication](#authentication)
5. [Course Management](#course-management)
6. [Course Offerings](#course-offerings)
7. [Teams Management](#teams-management)
8. [Interactions](#interactions)
9. [Enrollments](#enrollments)

---

## Health & Status

### Health Check

- **GET** `/health`
- **Description**: Check if the server is running
- **Auth**: Not required
- **Response**: `{ "ok": true, "ts": "..." }`

---

## User Management

### Get All Users

- **GET** `/api/users?limit=50&offset=0&includeDeleted=false`
- **Description**: Get paginated list of all users
- **Auth**: Required
- **Query Parameters**:
  - `limit` (number): Number of users per page (default: 50)
  - `offset` (number): Number of users to skip (default: 0)
  - `includeDeleted` (boolean): Include soft-deleted users (default: false)

### Get User by ID

- **GET** `/api/users/:id`
- **Description**: Get a specific user by their UUID
- **Auth**: Required (users can view themselves, admins/instructors can view anyone)
- **Path Parameters**:
  - `id` (UUID): User UUID

### Create User

- **POST** `/api/users`
- **Description**: Create a new user
- **Auth**: Required (Admin or Instructor)
- **Body**:

  ```json
  {
    "email": "user@ucsd.edu",
    "name": "User Name",
    "primary_role": "student",
    "status": "active",
    "institution_type": "ucsd",
    "major": "Computer Science",
    "academic_year": 2025
  }
  ```

### Update User

- **PUT** `/api/users/:id`
- **Description**: Update user information
- **Auth**: Required (users can update themselves, admins/instructors can update anyone)
- **Path Parameters**:
  - `id` (UUID): User UUID
- **Body**: Partial user object with fields to update

### Delete User (Soft Delete)

- **DELETE** `/api/users/:id`
- **Description**: Soft delete a user
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `id` (UUID): User UUID

### Restore User

- **POST** `/api/users/:id/restore`
- **Description**: Restore a soft-deleted user
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `id` (UUID): User UUID

### Get Users by Role

- **GET** `/api/users/role/:role?limit=50&offset=0`
- **Description**: Get users filtered by primary_role
- **Auth**: Required
- **Path Parameters**:
  - `role` (string): One of: `admin`, `instructor`, `student`, `unregistered`
- **Query Parameters**:
  - `limit` (number): Number of users per page
  - `offset` (number): Number of users to skip

### Get Users by Institution Type

- **GET** `/api/users/institution/:type?limit=50&offset=0`
- **Description**: Get users filtered by institution_type
- **Auth**: Required
- **Path Parameters**:
  - `type` (string): One of: `ucsd`, `extension`
- **Query Parameters**:
  - `limit` (number): Number of users per page
  - `offset` (number): Number of users to skip

---

## Roster Management

### Import Roster (JSON)

- **POST** `/api/users/roster/import/json`
- **Description**: Bulk import users from JSON array
- **Auth**: Required (Admin or Instructor)
- **Body**: Array of user objects

  ```json
  [
    {
      "email": "user1@ucsd.edu",
      "name": "User One",
      "primary_role": "student",
      "status": "active"
    }
  ]
  ```

### Import Roster (CSV)

- **POST** `/api/users/roster/import/csv`
- **Description**: Bulk import users from CSV file
- **Auth**: Required (Admin or Instructor)
- **Content-Type**: `multipart/form-data`
- **Body**: CSV file upload

### Export Roster (JSON)

- **GET** `/api/users/roster/export/json`
- **Description**: Export all users as JSON
- **Auth**: Required
- **Response**: JSON file download

### Export Roster (CSV)

- **GET** `/api/users/roster/export/csv`
- **Description**: Export all users as CSV
- **Auth**: Required
- **Response**: CSV file download

### Rollback Import

- **POST** `/api/users/roster/rollback`
- **Description**: Rollback the last roster import
- **Auth**: Required (Admin or Instructor)
- **Body**:

  ```json
  {
    "importedIds": ["uuid1", "uuid2", ...]
  }
  ```

---

## Authentication

### Get Current User

- **GET** `/api/user`
- **Description**: Get the currently authenticated user's information
- **Auth**: Required
- **Response**: User object with profile information

### Get Login Attempts

- **GET** `/api/login-attempts`
- **Description**: Get login attempt status (by email if authenticated, else by IP)
- **Auth**: Not required (but shows more info if authenticated)

---

## Course Management

### Get My Courses

- **GET** `/api/my-courses`
- **Description**: Get all courses the authenticated user is enrolled in
- **Auth**: Required
- **Response**: Array of course objects with enrollment details

### Create Course Invite

- **POST** `/api/courses/:courseId/invites`
- **Description**: Create enrollment invites for a course
- **Auth**: Required (Instructor or TA for the course)
- **Path Parameters**:
  - `courseId` (UUID): Course UUID
- **Body**:

  ```json
  {
    "emails": ["student1@ucsd.edu", "student2@ucsd.edu"],
    "role": "Student",
    "kind": "ucsd"
  }
  ```

### Enroll via Token

- **GET** `/enroll/:token`
- **Description**: Enroll in a course using an enrollment token
- **Auth**: Required
- **Path Parameters**:
  - `token` (string): Enrollment token from course invite

---

## Course Offerings

### Get Offering Details

- **GET** `/api/offerings/:offeringId`
- **Description**: Get course offering details with enrollment and team statistics
- **Auth**: Required
- **Path Parameters**:
  - `offeringId` (UUID): Offering UUID
- **Response**: Offering object with counts (student_count, ta_count, tutor_count, team_count)

### Get Offering Statistics

- **GET** `/api/offerings/:offeringId/stats`
- **Description**: Get detailed statistics for a course offering
- **Auth**: Required
- **Path Parameters**:
  - `offeringId` (UUID): Offering UUID
- **Response**:

  ```json
  {
    "enrollments": [
      { "course_role": "student", "status": "enrolled", "count": 78 }
    ],
    "teams": [
      { "status": "active", "count": 10 }
    ],
    "total_team_members": 75
  }
  ```

---

## Teams Management

### Get All Teams

- **GET** `/api/teams?offering_id=:id`
- **Description**: Get all teams for a course offering
- **Auth**: Required
- **Query Parameters**:
  - `offering_id` (UUID, required): Offering UUID
- **Response**: Array of team objects with member counts

### Get Team Details

- **GET** `/api/teams/:teamId`
- **Description**: Get team details with members
- **Auth**: Required
- **Path Parameters**:
  - `teamId` (UUID): Team UUID
- **Response**: Team object with members array

### Create Team

- **POST** `/api/teams`
- **Description**: Create a new team
- **Auth**: Required (Admin or Instructor)
- **Body**:

  ```json
  {
    "offering_id": "uuid",
    "name": "Team 11",
    "team_number": 11,
    "leader_id": "uuid",
    "status": "forming"
  }
  ```

### Update Team

- **PUT** `/api/teams/:teamId`
- **Description**: Update team details
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `teamId` (UUID): Team UUID
- **Body**: Partial team object

  ```json
  {
    "name": "Updated Team Name",
    "status": "active",
    "leader_id": "uuid"
  }
  ```

### Delete Team

- **DELETE** `/api/teams/:teamId`
- **Description**: Delete a team
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `teamId` (UUID): Team UUID

### Get Team Members

- **GET** `/api/teams/:teamId/members`
- **Description**: Get all members of a team
- **Auth**: Required
- **Path Parameters**:
  - `teamId` (UUID): Team UUID
- **Response**: Array of team member objects

### Add Team Member

- **POST** `/api/teams/:teamId/members`
- **Description**: Add a member to a team
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `teamId` (UUID): Team UUID
- **Body**:

  ```json
  {
    "user_id": "uuid",
    "role": "member"
  }
  ```

### Remove Team Member

- **DELETE** `/api/teams/:teamId/members/:userId`
- **Description**: Remove a member from a team
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `teamId` (UUID): Team UUID
  - `userId` (UUID): User UUID

---

## Interactions

### Submit Interaction Report

- **POST** `/api/interactions`
- **Description**: Submit an interaction report (positive or negative) for a team or student
- **Auth**: Required (Admin or Instructor)
- **Body**:

  ```json
  {
    "offering_id": "uuid",
    "team_id": "uuid",
    "user_id": "uuid",
    "interaction_type": "positive",
    "notes": "Great progress on Sprint 2 deliverables."
  }
  ```

- **Note**: Either `team_id` or `user_id` must be provided (or both)

### Get All Interactions

- **GET** `/api/interactions?offering_id=:id&team_id=:id&user_id=:id`
- **Description**: Get all interactions for an offering with optional filters
- **Auth**: Required (Admin or Instructor)
- **Query Parameters**:
  - `offering_id` (UUID, required): Offering UUID
  - `team_id` (UUID, optional): Filter by team
  - `user_id` (UUID, optional): Filter by student

### Get Team Interactions

- **GET** `/api/interactions/team/:teamId`
- **Description**: Get all interactions for a specific team
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `teamId` (UUID): Team UUID

### Get Student Interactions

- **GET** `/api/interactions/student/:userId`
- **Description**: Get all interactions for a specific student
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `userId` (UUID): User UUID

---

## Enrollments

### Create Enrollment

- **POST** `/api/enrollments`
- **Description**: Create a new enrollment
- **Auth**: Required (Admin or Instructor)
- **Body**:

  ```json
  {
    "offering_id": "uuid",
    "user_id": "uuid",
    "course_role": "student",
    "status": "enrolled"
  }
  ```

### Get Enrollment by ID

- **GET** `/api/enrollments/:id`
- **Description**: Get enrollment details
- **Auth**: Required (users can view their own, admins/instructors can view any)
- **Path Parameters**:
  - `id` (UUID): Enrollment UUID

### Get Enrollment by Offering and User

- **GET** `/api/enrollments/offering/:offeringId/user/:userId`
- **Description**: Get enrollment for a specific user in an offering
- **Auth**: Required (users can view their own, admins/instructors can view any)
- **Path Parameters**:
  - `offeringId` (UUID): Offering UUID
  - `userId` (UUID): User UUID

### Update Enrollment Role

- **PUT** `/api/enrollments/offering/:offeringId/user/:userId/role`
- **Description**: Promote/Demote student to TA/tutor or change course_role
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `offeringId` (UUID): Offering UUID
  - `userId` (UUID): User UUID
- **Body**:

  ```json
  {
    "course_role": "ta"
  }
  ```

### Update Enrollment Status

- **PUT** `/api/enrollments/:id/status`
- **Description**: Update enrollment status (enrolled, waitlisted, dropped, completed)
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `id` (UUID): Enrollment UUID
- **Body**:

  ```json
  {
    "status": "dropped"
  }
  ```

### Delete Enrollment

- **DELETE** `/api/enrollments/:id`
- **Description**: Delete an enrollment
- **Auth**: Required (Admin or Instructor)
- **Path Parameters**:
  - `id` (UUID): Enrollment UUID

---

## Authentication Methods

All authenticated endpoints require:

1. **Session-based authentication** (via Google OAuth)
2. **Cookie-based session** (set after successful login)

### Login Flow

1. **GET** `/auth/google` - Initiate Google OAuth login
2. **GET** `/auth/google/callback` - OAuth callback (handled automatically)
3. Session is created and user is redirected to appropriate dashboard

### Logout

- **GET** `/logout` - Logout and clear session

---

## Error Responses

All endpoints may return the following error responses:

- **400 Bad Request**: Invalid request parameters or body
- **401 Unauthorized**: Not authenticated
- **403 Forbidden**: Authenticated but not authorized (wrong role)
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

Error response format:

```json
{
  "error": "Error message description"
}
```

---

## Notes

- All UUIDs are in standard UUID format (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Dates are in ISO 8601 format (e.g., `2025-09-23`)
- Timestamps are in ISO 8601 with timezone (e.g., `2025-09-23T10:00:00Z`)
- All endpoints use HTTPS on port 8443 for local development
- For production, update `base_url` variable accordingly

---

## Quick Reference

### Common Variables

- `base_url`: `https://localhost:8443`
- `user_id`: User UUID (get from `/api/user` or create user response)
- `offering_id`: Course offering UUID (get from seed data or database)
- `team_id`: Team UUID (get from `/api/teams?offering_id=:id`)
- `course_id`: Legacy course UUID (use `offering_id` instead)

### Role Hierarchy

- **Admin**: Full access to all endpoints
- **Instructor**: Access to course/team management, user creation (students only)
- **TA/Tutor**: Access to course-specific endpoints (via enrollments)
- **Student**: Read-only access to own data and course information

---
