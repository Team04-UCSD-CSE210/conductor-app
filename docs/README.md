# Documentation Index

Welcome to the Conductor application documentation! This guide will help you understand, develop, and deploy the course management platform.

## Quick Navigation

### New to Conductor?

1. [Quick Start](getting-started/quick-start.md) - Get up and running in 5 minutes
2. [Installation](getting-started/installation.md) - Detailed setup guide
3. [Architecture Overview](architecture/overview.md) - Understand the system design

### Developers

- [Database Schema](database/schema.md) - Complete database reference
- [API Reference](backend/api-reference.md) - All endpoints documented
- [Frontend Guide](frontend/overview.md) - UI components and patterns
- [Contributing](contributing/workflow.md) - Development workflow
- [Known Issues](KNOWN-ISSUES.md) - Technical debt & quick fixes

### Operations

- [CI/CD Pipeline](deployment/ci-cd.md) - Automated deployment
- [Docker Guide](deployment/docker.md) - Container configuration
- [Testing](testing/overview.md) - Test suites and coverage

## Documentation Structure

### Getting Started
- [Quick Start](getting-started/quick-start.md) - Fast setup for immediate use
- [Installation](getting-started/installation.md) - Comprehensive installation guide
- [Local Development](getting-started/local-development.md) - Development environment setup

### Architecture
- [System Overview](architecture/overview.md) - High-level architecture and design
- [Tech Stack](architecture/tech-stack.md) - Technologies and libraries used
- [Architecture Decision Records (ADRs)](adrs/) - Technology selection rationale

### Database
- [Overview](database/overview.md) - Database architecture
- [Schema Reference](database/schema.md) - Complete table documentation
- [Migrations Guide](database/migrations.md) - How to manage schema changes
- [ER Diagrams](database/er-diagram.md) - Visual database structure

### Backend
- [Overview](backend/overview.md) - Backend architecture
- [API Reference](backend/api-reference.md) - Complete API documentation
- [Authentication](backend/authentication.md) - OAuth and session management
- [RBAC System](backend/rbac.md) - Permission system guide
- [Models](backend/models.md) - Data models documentation

### Frontend
- [Overview](frontend/overview.md) - Frontend architecture
- [Components](frontend/components.md) - UI component library
- [User Flows](frontend/user-flows.md) - User journey documentation
- [Styling Guide](frontend/styling.md) - CSS conventions and theming

### Testing
- [Overview](testing/overview.md) - Testing strategy
- [Unit Testing](testing/unit-testing.md) - Vitest unit tests
- [E2E Testing](testing/e2e-testing.md) - Playwright E2E tests
- [Load Testing](testing/load-testing.md) - Performance testing

### Deployment
- [CI/CD Pipeline](deployment/ci-cd.md) - Continuous integration/deployment
- [Docker](deployment/docker.md) - Container configuration
- [Production](deployment/production.md) - Production deployment guide
- [Monitoring](deployment/monitoring.md) - Observability with SigNoz

### Contributing
- [Getting Started](contributing/setup.md) - Contributor setup
- [Workflow](contributing/workflow.md) - Git workflow and PR process
- [Code Style](contributing/code-style.md) - Coding standards
- [Testing Guidelines](contributing/testing.md) - How to write tests

## Find What You Need

### By Role

**Backend Developer**
- [API Reference](backend/api-reference.md)
- [Database Schema](database/schema.md)
- [RBAC System](backend/rbac.md)

**Frontend Developer**
- [Frontend Overview](frontend/overview.md)
- [Component Guide](frontend/components.md)
- [User Flows](frontend/user-flows.md)

**DevOps Engineer**
- [CI/CD Pipeline](deployment/ci-cd.md)
- [Docker Guide](deployment/docker.md)
- [Monitoring](deployment/monitoring.md)

**QA Engineer**
- [Testing Overview](testing/overview.md)
- [E2E Testing](testing/e2e-testing.md)
- [Load Testing](testing/load-testing.md)

### By Task

**Setting up development environment**
→ [Installation Guide](getting-started/installation.md)

**Adding a new API endpoint**
→ [API Reference](backend/api-reference.md) + [RBAC Guide](backend/rbac.md)

**Modifying database schema**
→ [Migrations Guide](database/migrations.md)

**Creating new UI components**
→ [Component Guide](frontend/components.md)

**Deploying to production**
→ [Production Guide](deployment/production.md)

## Additional Resources

- [Known Issues & Technical Debt](KNOWN-ISSUES.md) - Current bugs and planned fixes
- [Architecture Decision Records](adrs/) - Design decisions explained
- [Project Wiki](https://github.com/Team04-UCSD-CSE210/conductor-app/wiki) - Team resources
- [Issue Tracker](https://github.com/Team04-UCSD-CSE210/conductor-app/issues) - Bug reports and features
- [Pull Requests](https://github.com/Team04-UCSD-CSE210/conductor-app/pulls) - Code reviews

## Getting Help

1. Check the relevant documentation section above
2. Search existing [GitHub Issues](https://github.com/Team04-UCSD-CSE210/conductor-app/issues)
3. Ask in team Slack channel
4. Create a new issue if problem persists

## Documentation Standards

All documentation follows:
- **Markdown** formatting
- **Mermaid** diagrams where applicable
- **Code examples** for clarity
- **Clear headings** and navigation
- **Up-to-date** with current codebase

## Keep Documentation Updated

When making changes:
- Update relevant docs in the same PR
- Add examples for new features
- Update diagrams if architecture changes
- Review docs in code review process

---

**Last Updated**: December 2025  
**Maintained by**: Team04-UCSD-CSE210
