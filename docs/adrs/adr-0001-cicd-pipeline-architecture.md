# ADR: CI/CD Pipeline Architecture

## Status

Accepted

## Context

The project required CI/CD pipelines to ensure code quality, automate testing, and manage
deployments. The team needed comprehensive validation for all code changes while maintaining
efficient deployment workflows that separate testing from production releases.

## Decision

Implemented dual-pipeline architecture:

### CI Pipeline (Validation)

- **Linting**: Code quality checks (ESLint, Stylelint, HTMLHint)
- **Testing**: Unit/integration tests with PostgreSQL
- **GitHub Additionals**: Auto-assign reviewers, PR compliance
- **Git Hooks**: Pre-commit validation, commit message formatting
- **Polypane**: Multi-device responsive testing
- **Code Climate**: Quality metrics and coverage reporting
- **Security**: Audit checks and secret scanning
- **Documentation**: JSDoc generation

### CD Pipeline (Build & Deploy)

- **Docker Build**: All branches get containerized images
- **Conditional Deployment**: Only `main` deploys to Render
- **Branch Isolation**: Feature branches build without deployment
- **Notifications**: Slack updates with deployment status

## Consequences

### Positive

- Comprehensive quality gates prevent bad code from merging
- Automated workflows reduce manual overhead
- Branch isolation enables safe feature development
- Production deployment limited to stable main branch
- Quality metrics track code health over time
- Security scanning prevents credential leaks

### Negative

- Longer feedback cycles due to comprehensive checks
- Additional complexity in pipeline configuration
- Dependency on external services (Code Climate, Render)

### Neutral

- Clear separation between validation and deployment concerns
- Standardized development workflow across team

## Alternatives Considered

1. **Single pipeline**: Rejected for lack of separation of concerns
2. **Deploy all branches**: Rejected to maintain production stability
3. **Manual deployment**: Rejected for efficiency and consistency

## Implementation Notes

- Requires secrets: `RENDER_SERVICE_ID`, `RENDER_API_KEY`, `CC_TEST_REPORTER_ID`, `SLACK_BOT_TOKEN`
- Need `npm run test:coverage` script for Code Climate
- Auto-assign targets current team structure
- Polypane requires Playwright test setup

## Related Decisions

None

## Date

November 23, 2025

## Participants

- Developer (Helena Hundhausen)
