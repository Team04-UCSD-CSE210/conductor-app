# Authentication & Login System Audit

## Overview

This document provides a comprehensive audit of all authentication and login-related
features, files, and implementations in the Conductor application.

**Last Updated**: 2025-01-XX  
**Authentication Method**: Google OAuth 2.0  
**Session Management**: Redis-backed Express Sessions  
**Database**: PostgreSQL with Sequelize ORM

---

## Table of Contents

1. [Core Features](#core-features)
2. [Architecture & Flow](#architecture--flow)
3. [Files & Components](#files-components)
4. [Routes & Endpoints](#routes-endpoints)
5. [Database Models](#database-models)
6. [Security Features](#security-features)
7. [Dependencies](#dependencies)
8. [Environment Variables](#environment-variables)
9. [User Roles & Types](#user-roles-types)
10. [Login Flow Diagrams](#login-flow-diagrams)

---

## Core Features

### 1. **Google OAuth 2.0 Authentication**

- Passport.js integration with Google OAuth 2.0 strategy
- Supports UCSD domain (@ucsd.edu) and whitelisted extension students
- Automatic user provisioning on first login

### 2. **Session Management**

- Redis-backed session store for scalability
- Express-session middleware for session handling
- Session persistence across requests

### 3. **Rate Limiting & Security**

- Redis-based login attempt tracking
- Configurable failure thresholds and time windows
- Whitelist bypass for approved users
- IP and email-based tracking

### 4. **Access Control**

- Whitelist system for extension students
- Access request workflow for non-UCSD users
- Admin approval system
- Role-based dashboard routing

### 5. **Authentication Logging**

- Comprehensive audit logging of all auth events
- Event types: LOGIN_SUCCESS, LOGIN_FAILURE, LOGIN_RATE_LIMITED, etc.
- IP address, user email, and metadata tracking

### 6. **User Registration Flow**

- Unregistered users redirected to registration page
- Role selection (Admin, Professor, TA, Student)
- Automatic course enrollment for students

### 7. **Course Enrollment**

- Token-based enrollment system
- Invite generation for UCSD and extension students
- Role-based enrollment (Student, TA, Tutor, Professor)

---

## Architecture & Flow

### High-Level Architecture

```text
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. GET /login
       ▼
┌─────────────────┐
│  Express Server │
│   (server.js)   │
└──────┬──────────┘
       │
       │ 2. GET /auth/google
       ▼
┌─────────────────┐
│  Google OAuth   │
│     Service     │
└──────┬──────────┘
       │
       │ 3. Callback with code
       ▼
┌─────────────────┐
│ Passport Strategy│
│  (Google OAuth)  │
└──────┬───────────┘
       │
       ├─► Check Rate Limits (Redis)
       ├─► Check Whitelist (PostgreSQL)
       ├─► Validate Domain
       ├─► Create/Find User
       └─► Log Auth Event
       │
       │ 4. Serialize User
       ▼
┌─────────────────┐
│  Redis Session  │
│      Store      │
└──────┬──────────┘
       │
       │ 5. Redirect to Dashboard
       ▼
┌─────────────────┐
│  Role-Based     │
│   Dashboard     │
└─────────────────┘
```text

### Login Flow Sequence

1. **User visits `/login`**
   - Session cleared if exists
   - Login page served

2. **User clicks "Sign in with Google"**
   - Redirects to `/auth/google`
   - Passport initiates OAuth flow
   - User authenticates with Google

3. **Google OAuth Callback**
   - Callback URL: `/auth/google/callback`
   - Passport strategy validates:
     - Rate limit status (Redis)
     - Whitelist status (PostgreSQL)
     - Domain validation (@ucsd.edu or whitelisted)
   - User created/found in database
   - Session established

4. **Dashboard Routing**
   - Based on `user_type`:
     - `Admin` → `/admin-dashboard`
     - `Professor` → `/faculty-dashboard`
     - `TA` → `/ta-dashboard`
     - `Student` → `/student-dashboard`
     - `Unregistered` → `/register.html`

5. **Registration (if unregistered)**
   - User selects role
   - POST `/register/submit`
   - User role updated
   - Redirect to login for re-authentication

---

## Files & Components {#files-components}

### Core Server Files

#### `server.js` (Root)

- **Purpose**: Main application server with OAuth and session management
- **Lines**: ~957
- **Key Responsibilities**:
  - Express app setup
  - Passport.js configuration
  - Google OAuth strategy
  - Session middleware (Redis)
  - Route handlers
  - Authentication middleware
  - Rate limiting logic
  - Auth event logging

#### `src/config/db.js`

- **Purpose**: Sequelize database configuration
- **Key Features**:
  - PostgreSQL connection setup
  - SSL mode configuration
  - Dialect options builder

### Database Models (Sequelize)

#### `src/models/auth-log.js`

- **Purpose**: Authentication event logging model
- **Table**: `auth_logs`
- **Fields**:
  - `event_type` (STRING)
  - `message` (TEXT)
  - `user_email` (STRING)
  - `ip_address` (STRING)
  - `user_id` (STRING)
  - `path` (STRING)
  - `metadata` (JSONB)
  - `created_at` (TIMESTAMP)

#### `src/models/whitelist.js`

- **Purpose**: Whitelist management for extension students
- **Table**: `whitelist`
- **Fields**:
  - `email` (STRING, unique)
  - `approved_by` (STRING)
  - `approved_at` (TIMESTAMP)

#### `src/models/access-request.js`

- **Purpose**: Access request tracking for non-UCSD users
- **Table**: `access_requests`
- **Fields**:
  - `email` (STRING)
  - `reason` (TEXT)
  - `requested_at` (TIMESTAMP)

#### `src/models/course-models.js`

- **Purpose**: Course, enrollment, and invite models
- **Tables**:
  - `courses`
  - `course_users` (enrollments)
  - `invites`

### View Files

#### `src/views/login.html`

- **Purpose**: Login page UI
- **Features**:
  - Google OAuth button
  - Redirects to `/auth/google`

#### `src/views/register.html`

- **Purpose**: User registration page
- **Features**:
  - Role selection dropdown
  - POST to `/register/submit`
  - Available roles: Admin, Instructor, Student

#### `src/views/blocked.html`

- **Purpose**: Access denied page
- **Features**:
  - Shows blocked email
  - Access request form
  - Admin contact information

#### Dashboard Views

- `src/views/admin-dashboard.html`
- `src/views/professor-dashboard.html`
- `src/views/ta-dashboard.html`
- `src/views/student-dashboard.html`
- `src/views/tutor-dashboard.html`

### Scripts

#### `scripts/prune-auth-logs.js`

- **Purpose**: Cleanup old authentication logs
- **Usage**: `npm run prune:auth-logs`

### Tests

#### `tests/auth-log.test.js`

- **Purpose**: Authentication log model tests

---

## Routes & Endpoints {#routes-endpoints}

### Authentication Routes

| Method | Route | Purpose | Auth Required |
|--------|-------|---------|----------------|
| GET | `/` | Root redirect to login | No |
| GET | `/login` | Login page | No |
| GET | `/auth/google` | Initiate Google OAuth | No |
| GET | `/auth/google/callback` | OAuth callback handler | No |
| GET | `/auth/failure` | OAuth failure page | No |
| GET | `/auth/error` | OAuth error page | No |
| GET | `/logout` | Logout and destroy session | No |

### Registration Routes

| Method | Route | Purpose | Auth Required |
|--------|-------|---------|----------------|
| POST | `/register/submit` | Submit role registration | Yes |

### Dashboard Routes

| Method | Route | Purpose | Auth Required |
|--------|-------|---------|----------------|
| GET | `/dashboard` | Generic dashboard | Yes |
| GET | `/admin-dashboard` | Admin dashboard | Yes |
| GET | `/faculty-dashboard` | Professor dashboard | Yes |
| GET | `/ta-dashboard` | TA dashboard | Yes |
| GET | `/student-dashboard` | Student dashboard | Yes |

### API Routes

| Method | Route | Purpose | Auth Required |
|--------|-------|---------|----------------|
| GET | `/api/user` | Get authenticated user info | Yes |
| GET | `/api/login-attempts` | Get login attempt status | No |
| GET | `/api/my-courses` | Get user's enrolled courses | Yes |

### Admin Routes

| Method | Route | Purpose | Auth Required |
|--------|-------|---------|----------------|
| GET | `/admin/whitelist` | View pending access requests | No |
| GET | `/admin/approve` | Approve access request | No |

### Access Request Routes

| Method | Route | Purpose | Auth Required |
|--------|-------|---------|----------------|
| POST | `/request-access` | Submit access request | No |

### Course Enrollment Routes

| Method | Route | Purpose | Auth Required |
|--------|-------|---------|----------------|
| POST | `/api/courses/:courseId/invites` | Create enrollment invites | Yes (Instructor) |
| GET | `/enroll/:token` | Enroll via invite token | No (redirects to auth) |

---

## Database Models {#database-models}

### User Model (Defined in `server.js`)

```javascript
User {
  email: STRING (unique, required)
  name: STRING
  user_type: ENUM('Admin', 'Professor', 'TA', 'Student', 'Unregistered')
  created_at: DATE
}
```text

### AuthLog Model

```javascript
AuthLog {
  event_type: STRING
  message: TEXT
  user_email: STRING
  ip_address: STRING
  user_id: STRING
  path: STRING
  metadata: JSONB
  created_at: TIMESTAMP
}
```text

### Whitelist Model

```javascript
Whitelist {
  email: STRING (unique, required)
  approved_by: STRING
  approved_at: TIMESTAMP
}
```text

### AccessRequest Model

```javascript
AccessRequest {
  email: STRING (required)
  reason: TEXT
  requested_at: DATE
}
```text

### Course Models

```javascript
Course {
  id: INTEGER
  code: STRING
  title: STRING
  // ... other fields
}

CourseUser {
  course_id: INTEGER
  user_id: INTEGER
  role: ENUM('Student', 'TA', 'Tutor', 'Professor')
  // ... other fields
}

Invite {
  course_id: INTEGER
  email: STRING (nullable)
  role: STRING
  token: STRING
  expires_at: DATE
  created_by: STRING
  kind: ENUM('ucsd', 'extension', 'staff')
  verified: BOOLEAN
  accepted_at: DATE
}
```text

---

## Security Features {#security-features}

### 1. **Rate Limiting**

- **Storage**: Redis
- **Key Format**: `login_attempts:{identifier}`
- **Identifier**: Email (if available) or IP address
- **Threshold**: `LOGIN_FAILURE_THRESHOLD` (default: 3)
- **Window**: `LOGIN_FAILURE_WINDOW_MINUTES` (default: 15 minutes)
- **Bypass**: Whitelisted users bypass rate limits

### 2. **Domain Validation**

- UCSD emails (@ucsd.edu) automatically allowed
- Non-UCSD emails require whitelist approval
- Domain extracted from Google profile `hd` field

### 3. **Session Security**

- Redis-backed sessions (not in-memory)
- Session secret required from environment
- HTTPS support (if certificates available)
- Session destruction on logout

### 4. **Authentication Middleware**

- `ensureAuthenticated` middleware protects routes
- Logs unauthorized access attempts
- JSON/HTML response based on request type

### 5. **Auth Event Logging**

- All authentication events logged
- IP address tracking
- Metadata capture for debugging
- Event types:
  - `LOGIN_SUCCESS`
  - `LOGIN_FAILURE`
  - `LOGIN_RATE_LIMITED`
  - `LOGIN_REJECTED_DOMAIN`
  - `LOGIN_SUCCESS_WHITELIST`
  - `LOGIN_SUCCESS_WHITELIST_BYPASS`
  - `LOGIN_ERROR`
  - `ROUTE_UNAUTHORIZED_ACCESS`
  - `PROFILE_UNAUTHORIZED`
  - `ENROLL_SUCCESS`
  - `ENROLL_REJECTED_DOMAIN`
  - `INVITE_INVALID`
  - `INVITE_EMAIL_MISMATCH`
  - `ACCESS_REQUEST_SUBMITTED`
  - `ACCESS_REQUEST_UPDATED`
  - `COURSE_FORBIDDEN`

---

## Dependencies {#dependencies}

### Core Authentication

```json
{
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "express-session": "^1.18.2",
  "connect-redis": "^9.0.0",
  "redis": "^5.9.0"
}
```text

### Database

```json
{
  "sequelize": "^6.37.7",
  "pg": "^8.16.3",
  "pg-hstore": "^2.3.4"
}
```text

### Utilities

```json
{
  "express": "^4.21.2",
  "dotenv": "^17.2.3",
  "cors": "^2.8.5"
}
```text

---

## Environment Variables {#environment-variables}

### Required Variables

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CALLBACK_URL=https://localhost:8443/auth/google/callback

# Session
SESSION_SECRET=your_session_secret

# Database
DATABASE_URL=postgresql://user:password@host:port/database
PGSSLMODE=disable|no-verify|require

# Redis
REDIS_URL=redis://localhost:6379

# Domain
ALLOWED_GOOGLE_DOMAIN=ucsd.edu
```text

### Optional Variables

```bash
# Rate Limiting
LOGIN_FAILURE_THRESHOLD=3
LOGIN_FAILURE_WINDOW_MINUTES=15

# Course Invites
INVITE_TTL_HOURS=72
INVITE_SECRET=your_invite_secret

# Server
PORT=8080
VERCEL=true|false
```text

---

## User Roles & Types {#user-roles-types}

### User Types (user_type enum)

1. **Admin**
   - Full system access
   - Dashboard: `/admin-dashboard`
   - Can approve access requests

2. **Professor**
   - Course management access
   - Dashboard: `/faculty-dashboard`
   - Can create course invites

3. **TA** (Teaching Assistant)
   - Course assistance access
   - Dashboard: `/ta-dashboard`
   - Assigned via course enrollment

4. **Student**
   - Standard student access
   - Dashboard: `/student-dashboard`
   - Auto-enrolled in courses

5. **Unregistered**
   - New users default to this
   - Must register to select role
   - Redirected to `/register.html`

### Course Roles (course_users.role)

1. **Student** - Enrolled student
2. **TA** - Teaching Assistant
3. **Tutor** - Course tutor
4. **Professor** - Course instructor

---

## Login Flow Diagrams {#login-flow-diagrams}

### Successful UCSD Login

```text
User → /login
  ↓
Click "Sign in with Google"
  ↓
GET /auth/google
  ↓
Google OAuth
  ↓
GET /auth/google/callback
  ↓
Passport Strategy:
  ├─ Check domain → @ucsd.edu ✓
  ├─ Clear rate limits
  ├─ Find/Create User (user_type: Unregistered)
  ├─ Log LOGIN_SUCCESS
  └─ Serialize user to session
  ↓
Redirect based on user_type:
  ├─ Admin → /admin-dashboard
  ├─ Professor → /faculty-dashboard
  ├─ TA → /ta-dashboard
  ├─ Student → /student-dashboard
  └─ Unregistered → /register.html
```text

### Whitelisted Extension Student Login

```text
User → /login
  ↓
Click "Sign in with Google"
  ↓
GET /auth/google
  ↓
Google OAuth
  ↓
GET /auth/google/callback
  ↓
Passport Strategy:
  ├─ Check domain → gmail.com (not UCSD)
  ├─ Check whitelist → Found ✓
  ├─ Bypass rate limits
  ├─ Find/Create User (user_type: Unregistered)
  ├─ Log LOGIN_SUCCESS_WHITELIST
  └─ Serialize user to session
  ↓
Redirect to /register.html
  ↓
User selects role → POST /register/submit
  ↓
Redirect to /auth/google (re-login)
  ↓
Dashboard based on selected role
```text

### Rejected Login (Non-Whitelisted)

```text
User → /login
  ↓
Click "Sign in with Google"
  ↓
GET /auth/google
  ↓
Google OAuth
  ↓
GET /auth/google/callback
  ↓
Passport Strategy:
  ├─ Check domain → gmail.com (not UCSD)
  ├─ Check whitelist → Not found ✗
  ├─ Record failed attempt (Redis)
  ├─ Log LOGIN_REJECTED_DOMAIN
  └─ Return error
  ↓
Redirect to /auth/failure
  ↓
Show blocked.html with access request form
```text

### Rate Limited Login

```text
User → /login
  ↓
Multiple failed attempts
  ↓
GET /auth/google/callback
  ↓
Passport Strategy:
  ├─ Check rate limit status
  ├─ Get attempts from Redis
  ├─ Check if blocked → Yes ✗
  ├─ Log LOGIN_RATE_LIMITED
  └─ Return error
  ↓
Redirect to /auth/failure
  ↓
Show "Too many failed attempts" message
```text

---

## Key Functions & Middleware

### Authentication Middleware

```javascript
ensureAuthenticated(req, res, next)
```text

- Checks if user is authenticated via `req.isAuthenticated()`
- Logs unauthorized access attempts
- Redirects to `/login` if not authenticated
- Returns JSON error for API requests

### Rate Limiting Functions

```javascript
getLoginIdentifier(email, req)
// Returns: email if available, else IP address

getLoginAttemptStatus(identifier)
// Returns: { blocked: boolean, attempts: number }

recordFailedLoginAttempt(identifier)
// Increments attempt counter in Redis

clearLoginAttempts(identifier)
// Clears attempt counter from Redis
```text

### Auth Logging

```javascript
logAuthEvent(eventType, { req, message, userEmail, userId, metadata })
// Logs authentication event to auth_logs table
```text

### User Management

```javascript
User.findOrCreate({ where: { email }, defaults: {...} })
// Creates user if doesn't exist, returns existing if found
```text

---

## Testing

### Test Files

- `tests/auth-log.test.js` - Auth log model tests

### Manual Testing Checklist

- [ ] UCSD user can login
- [ ] Whitelisted extension user can login
- [ ] Non-whitelisted extension user is blocked
- [ ] Rate limiting works after 3 failed attempts
- [ ] Whitelisted users bypass rate limits
- [ ] Unregistered users redirected to registration
- [ ] Role selection updates user_type
- [ ] Dashboard routing based on user_type
- [ ] Session persists across requests
- [ ] Logout destroys session
- [ ] Auth events logged correctly

---

## Maintenance

### Pruning Auth Logs

Run periodically to clean old logs:

```bash
npm run prune:auth-logs
```text

### Monitoring

- Check Redis for rate limit keys: `login_attempts:*`
- Monitor `auth_logs` table for suspicious activity
- Review `access_requests` for pending approvals

---

## Future Enhancements

1. **Email Notifications**
   - Send invite emails automatically
   - Notify admins of access requests
   - Welcome emails for new users

2. **Two-Factor Authentication**
   - Optional 2FA for admin accounts
   - SMS or authenticator app support

3. **Password-Based Login**
   - Alternative to OAuth for specific use cases
   - Password reset functionality

4. **Session Management UI**
   - View active sessions
   - Revoke sessions remotely

5. **Advanced Rate Limiting**
   - Per-IP and per-email limits
   - Progressive delays
   - CAPTCHA after multiple failures

---

## Notes

- The system uses Sequelize ORM for database operations
- Redis is required for session storage and rate limiting
- HTTPS is recommended for production (SSL certificates in `certs/`)
- All authentication events are logged for audit purposes
- Whitelist system allows extension students to access the system
- Access requests can be approved by admins via `/admin/approve`

---

