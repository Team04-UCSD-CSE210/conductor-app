# ADR-0003: Authentication Scheme Selection — Google OAuth, Whitelist, Session

## Status

Accepted

## Context

- The application is primarily intended for UCSD users, but needs to allow a  
  small number of non-UCSD accounts to access it with administrator approval.
- We aim to use a mature external identity provider to reduce password
  management and security costs.
- Support for roles (admin, instructor, student, unregistered), course
  enrollment, audit logs, and controlled access request flows is required.
- Degradation operation without Redis or HTTPS should be allowed during local
  development.

## Decision

The primary authentication method is Google OAuth 2.0
(passport-google-oauth20), combined with the following strategies (based on
the `server.js` implementation):

- Non-UCSD Accounts: Accounts must exist in the whitelist (administrator
  approval) to log in; otherwise, login is rejected and counted as a failure.

- Login Rate Limit: Counts based on identifiers (email or IP), with
  configurable default thresholds (LOGIN_FAILURE_THRESHOLD,
  LOGIN_FAILURE_WINDOW_MINUTES). The design uses Redis for persistent
  counting; server.js supports fallback when Redis is unavailable (currently,
  Redis is disabled and a warning is printed).

- Session: Use express-session (SESSION_SECRET required), cookie configured
  as httpOnly, sameSite=lax, with configurable expiration time. Secure (HTTPS)
  should be enabled in production environments.

- Audit Logs: Critical authentication events are written to the auth_logs
  table. Examples include LOGIN_SUCCESS, LOGIN_FAILURE,
  LOGIN_RATE_LIMITED, ACCESS_REQUEST_*, LOGOUT_*, etc.

- Management Workflow: Unauthorized non-UCSD users can submit requests via
  `/request-access`, which leads to `access_requests`. Administrators review
  and approve requests via the `/admin/whitelist` page and the `/admin/approve`
  endpoint. Approval adds the email to the whitelist and creates a `users`
  record with `primary_role=unregistered`.

- Login Process: `/auth/google` forces a prompt `select_account`. Callback
  logic inspects `users.primary_role` and `enrollments` and redirects to the
  appropriate page (dashboard, register, admin, instructor, ta, student).

## Consequences

### Positive

- Reduce the cost of building your own password management and security
  maintenance by using Google OAuth.
- Whitelisting and access request processes provide a controlled extension
  path for non-UCSD users.
- Audit logs provide a traceable record of security incidents.

### Negative

- Relies on Google OAuth: external service interruptions or misconfigurations
  can affect login availability.

### Neutral

- Sessions are stored in memory by default; in production, this needs to be
  replaced with a persistent store (such as Redis).

## Alternatives Considered

1. **Self-created username/password:** More independent but increases
   password/reset/security maintenance costs, therefore not adopted.
2. **Identity platforms such as Auth0/Firebase:** Functionally complete but
   introduces commercial dependencies and costs, and does not meet the
   current needs of primarily using campus Google.

## Date

11/04/2025

## Participants

- Akshit
- Bimal
- Cheng
- Rahat
