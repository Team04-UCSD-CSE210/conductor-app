# Conductor-App

Final project for CSE 210.

## Pipeline

### CI Pipeline

This project includes automated CI validation through GitHub Actions that
runs on all pull requests and pushes:

- **Linting**: JavaScript (ESLint), CSS (Stylelint), and HTML (HTMLHint) validation
- **Testing**: Automated test execution
- **Documentation**: JSDoc generation
- **Commit Title Validation**: Ensures commit message conventions
- **Slack Notifications**: Automated status updates to team channel

The pipeline ensures code quality and consistency across all contributions.

### CD Pipeline

This project will have CD once the deployment environment is confirmed.

## Team Standards & Deployment Policies

## On-Call Rotation

Each sprint requires one designated on-call engineer to ensure system reliability.

**Assignments:**

- **Primary On-call:** Per sub-team

**Responsibilities:**

- First responder for all pull requests and merge conflicts to `main` branch
- Rotate assignments at the start of each sprint

## Testing Requirements

All code changes must include comprehensive test coverage to maintain system reliability.

**Mandatory Testing:**

- Unit tests for all new functionality
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Minimum 80% code coverage required

**Test Naming Convention:**

- Descriptive test names: `should_return_user_data_when_valid_id_provided`

## Sprint Process

**Duration:** 1-week sprints
**Start Date:** November 3rd, 2025
**Schedule:**

- Sprint Planning: First Saturday of each sprint
- Standups: Via slack-bot in `#status` slack channel
- Sprint Review & Retrospective: Last Friday of sprint

## Branching Strategy

Structured branching ensures clean code organization & deployment safety.

- **`main`**: Production-ready code only - requires PR approval
- **`spec/[description]`**: Documentation (`bugfix/login-timeout`)
- **`feature/[description]`**: New features (`feature/user-login`)
- **`bugfix/[description]`**: Bug fixes (`bugfix/login-timeout`)

**Branch Protection Rules:**

- Direct pushes to `main` are prohibited
- All branches must be up-to-date before merging
- Delete feature branches after successful merge

## Naming Conventions

**Commit Message Guidelines:** Follow [Conventional Commits](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13)
for structured commit messages.

Consistent naming improves code readability and maintainability.

| Type | Convention | Example |
|------|------------|---------|
| **Files** | kebab-case | `user-profile.js`, `api-client.ts` |
| **Variables** | camelCase | `userName`, `isAuthenticated` |
| **Constants** | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_RETRY_ATTEMPTS` |
| **Classes** | PascalCase | `UserManager`, `DatabaseConnection` |
| **Functions** | camelCase | `getUserData()`, `validateInput()` |
| **Branches** | lowercase-with-hyphens | `feature/add-search` |
| **Commits** | conventional commits | `<type>: <description>` |
| **PRs** | conventional commits | `feat: Add user search functionality` |

### 1. Branch Creation

bash
git checkout main
git pull origin main
git checkout -b feature/[description]

### 2. Development Process

- Implement changes following coding standards `npm run lint`
- Write corresponding test cases
- Run local tests: `npm test` or equivalent
- Ensure code coverage meets minimum threshold

### 3. Pre-Submission Checklist

- [ ] All tests pass locally
- [ ] Code follows naming conventions
- [ ] Documentation updated if needed
- [ ] No console.log or debug statements
- [ ] Security best practices followed & No API keys provided

### 4. Pull Request Submission

- Create PR with naming convention and detailed description
- Link related GitHub issues
- Add appropriate labels (feature, bugfix, etc.)
- Request review from on-call team member(s)
- Ensure CI/CD pipeline passes all checks

### 5. Code Review Process

- Address all reviewer feedback
- Maintain clean commit history (squash if necessary)
- Obtain required approvals before merging

### 6. Deployment

- Merge to `main` triggers automated deployment
- Monitor deployment metrics and logs
- Verify functionality in production environment
- Rollback plan ready if issues arise

## Code Review Standards

All pull requests require review.

**Review Criteria:**

- Code functionality and correctness
- Adherence to naming conventions and standards
- Test coverage and quality
- Security considerations
- Performance implications
- Documentation completeness

## Communication & Feedback

Regular communication ensures team alignment and continuous improvement.

### Standups (10:00 AM PST on Tuesdays & Thursdays via Slack Bot)

- What you completed since last check-in
- What you're working on today

## Environment Variables

Create a `.env` file at the project root before running `npm start`. Required keys:

| Key | Description |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID issued to the Conductor OAuth app |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret for the same app |
| `GOOGLE_CALLBACK_URL` | Public callback URL registered with Google (e.g., `http://localhost:3000/auth/google/callback`) |
| `SESSION_SECRET` | Random string used to sign Express session cookies |
| `DATABASE_URL` | PostgreSQL connection string for audit logging (e.g., `postgres://user:pass@localhost:5432/conductor`) |

Optional keys:

| Key | Description |
| --- | --- |
| `ALLOWED_GOOGLE_DOMAIN` | Domain restriction for OAuth logins (defaults to `ucsd.edu`) |
| `ALLOWED_ORIGINS` | Comma-separated list of origins allowed by CORS |
| `SESSION_SAME_SITE` | Explicit SameSite policy for the session cookie (`lax`, `strict`, or `none`) |
| `SESSION_SECURE` | Set to `true` to force secure cookies even in non-production environments |
| `SESSION_COOKIE_DOMAIN` | Override cookie domain when hosting behind a shared domain |
| `SUCCESS_REDIRECT_URL` | Redirect location after successful login (defaults to `/auth/success`) |
| `FAILURE_REDIRECT_URL` | Redirect location after failed login (defaults to `/auth/failure`) |
| `PORT` | Port for the Express server (defaults to `3000`) |
| `NODE_ENV` | Standard Node environment flag (`development`, `production`, etc.) |
| `LOGIN_FAILURE_THRESHOLD` | Number of failed logins within the window that triggers an alert log (defaults to `5`) |
| `LOGIN_FAILURE_WINDOW_MINUTES` | Minutes used to evaluate excessive login failures (defaults to `15`) |
| `PGSSLMODE` | Set to `disable`, `no-verify`, or another libpq-compatible value to control TLS when connecting to Postgres |

To initialize a local development database, run the migration script after creating your database:

```bash
psql "$DATABASE_URL" -f schema.sql
```

## Database Setup

Follow this procedure to prepare a local PostgreSQL instance:

1. Confirm the `psql` client is available:

   ```bash
   psql --version
   ```

2. Connect as a superuser (e.g., `postgres`) and run:

   ```sql
   CREATE USER conductor_app_user WITH PASSWORD 'YOUR_PASSWORD';
   CREATE DATABASE conductor_db OWNER conductor_app_user;
   GRANT ALL PRIVILEGES ON DATABASE conductor_db TO conductor_app_user;
   ```

3. Disconnect from the session with `\q`.

- Any blockers or dependencies

### Sprint Review & Retrospectives

- What went well this sprint
- What could be improved
- Action items for next sprint
- Process adjustments and team feedback

### Issue Tracking

- **GitHub Issues**: Bug reports and feature requests
- **Labels**: Use appropriate labels (bug, enhancement, documentation)
- **Assignments**: Assign issues during sprint planning
- **Updates**: Comment on progress and blockers
