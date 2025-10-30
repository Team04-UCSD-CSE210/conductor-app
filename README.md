# Conductor-App

Final project for CSE 210.

## Pipeline

### CI Pipeline

This project includes automated CI validation through GitHub Actions that
runs on all pull requests and pushes:

- **Linting**: JavaScript (ESLint), CSS (Stylelint), and HTML (HTMLHint) validation
- **Testing**: Automated test execution
- **Documentation**: JSDoc generation
- **Commit Title Validation**: Ensures commit message conventions under [conventional Commits](https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13)
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

**Duration:** 2-week sprints
**Start Date:** November 3rd, 2024
**Schedule:**

- Sprint Planning: First Monday of each sprint
- Standups: Via slack-bot in `#status` slack channel
- Sprint Review & Retrospective: Last Friday of sprint

## Branching Strategy

Structured branching ensures clean code organization & deployment safety.

- **`main`**: Production-ready code only - requires PR approval
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

- Implement changes following coding standards
- Write corresponding test cases (unit, integration, e2e as needed)
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
- Request review from on-call team member
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

All pull requests require thorough review to maintain code quality.

**Review Criteria:**

- Code functionality and logic correctness
- Adherence to naming conventions and standards
- Test coverage and quality
- Security considerations
- Performance implications
- Documentation completeness

## Communication & Feedback

Regular communication ensures team alignment and continuous improvement.

### Standups (10:00 AM PST)

- What you completed since last check-in
- What you're working on today
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

## Deployment Policies

### Production Deployments

- Only from `main` branch
- Automated via CI/CD pipeline
- Requires successful test suite execution
- Database migrations run automatically
- Rollback capability within 5 minutes
