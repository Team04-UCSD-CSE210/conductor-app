# Conductor

> **A comprehensive course management platform for CSE 210 Software Engineering**

[![CI Pipeline](https://github.com/Team04-UCSD-CSE210/conductor-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Team04-UCSD-CSE210/conductor-app/actions/workflows/ci.yml)
[![Testing Suite](https://github.com/Team04-UCSD-CSE210/conductor-app/actions/workflows/testing.yml/badge.svg)](https://github.com/Team04-UCSD-CSE210/conductor-app/actions/workflows/testing.yml)

## Overview

Conductor is a full-stack web application designed to streamline course management, team collaboration, attendance tracking, and student engagement for CSE 210 at UC San Diego. Built with modern web technologies and enterprise-grade architecture, it provides role-based dashboards for administrators, instructors, TAs, tutors, and students.

### Key Features

- **Role-Based Dashboards**: Customized interfaces for 6 user roles (Admin, Instructor, Professor, TA, Tutor, Student/Student Leader)
- **Attendance Management**: QR code-based check-in with session questions and analytics
- **Team Collaboration**: Team formation, member management, and team-specific announcements
- **Journal System**: Role-specific journaling for students, TAs, tutors, and instructors
- **RBAC Permissions**: Fine-grained permission system with global, course, and team scopes
- **Real-time Analytics**: Performance metrics, attendance statistics, and course progress tracking
- **Observability**: SigNoz/OpenTelemetry integration for metrics, traces, and monitoring

## Quick Start

```bash
# Clone and install
git clone https://github.com/Team04-UCSD-CSE210/conductor-app.git
cd conductor-app
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Initialize database with demo data
npm run db:seed

# Start the server
npm start
```

Visit `http://localhost:8443` to access the application.

📖 **For detailed setup**, see [Installation Guide](docs/getting-started/installation.md)

## Documentation

### 📚 Core Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started/quick-start.md) | Quick setup and first steps |
| [Architecture Overview](docs/architecture/overview.md) | System design and tech stack |
| [Database Schema](docs/database/schema.md) | Complete database reference |
| [API Reference](docs/backend/api-reference.md) | All API endpoints and contracts |
| [RBAC System](docs/backend/rbac.md) | Permission system guide |
| [Frontend Guide](docs/frontend/overview.md) | UI components and flows |
| [Testing Guide](docs/testing/overview.md) | Unit, E2E, and load testing |
| [Deployment](docs/deployment/ci-cd.md) | CI/CD pipeline and Docker |

### 🎯 Additional Resources

- [Database Migrations](docs/database/migrations.md) - Schema change management
- [Contributing Guide](docs/contributing/workflow.md) - Development workflow
- [ADRs](docs/architecture/adrs/) - Architecture decision records
- [Project Wiki](https://github.com/Team04-UCSD-CSE210/conductor-app/wiki) - Team resources

## Tech Stack

**Backend**: Node.js 18+, Express.js, PostgreSQL 18, Passport.js (OAuth)  
**Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)  
**Testing**: Vitest, Playwright, Autocannon  
**DevOps**: GitHub Actions, Docker, Render, AWS ECS  
**Observability**: SigNoz, OpenTelemetry

📖 **Details**: [Architecture Overview](docs/architecture/overview.md)


## Development

### Project Structure

```
conductor-app/
├── src/
│   ├── server.js              # Application entry point
│   ├── routes/                # API route handlers (18 files)
│   ├── middleware/            # Express middleware
│   ├── models/                # Data models
│   ├── database/              # Database utilities
│   ├── views/                 # HTML templates
│   └── public/                # Static assets (CSS, JS, images)
├── migrations/                # Database migrations (33 files)
├── scripts/                   # Utility scripts
│   ├── init-db.js            # Database initialization
│   ├── load-test.js          # Load testing
│   └── perf-*.js             # Performance benchmarks
├── e2e/                       # End-to-end tests (5 suites)
├── docs/                      # Documentation
└── config/                    # Linting & tool configuration
```

### Available Scripts

```bash
# Development
npm start                 # Start server (port 8443)
npm run db:init          # Initialize database schema
npm run db:seed          # Initialize with demo data
npm run db:reset         # Drop and recreate database
npm run db:force         # Force re-run migrations

# Testing
npm test                 # Run unit tests with coverage
npm run test:e2e         # Run E2E tests (all browsers)
npm run test:e2e:chromium # Run E2E tests (Chromium only)
npm run test:e2e:ui      # Run E2E tests with UI
npm run test:load        # Run load tests (150+ concurrent users)

# Quality & Linting
npm run lint             # Run all linters
npm run lint:js          # ESLint only
npm run lint:css         # Stylelint only
npm run lint:html        # HTMLHint only
npm run lint:md          # Markdownlint only

# Documentation & Performance
npm run docs             # Generate JSDoc documentation
npm run perf:db          # Database performance benchmarks
npm run perf:api         # API performance benchmarks
```

## Testing

Comprehensive test coverage across multiple levels:

| Test Type | Tool | Coverage | Results |
|-----------|------|----------|---------|
| **Unit Tests** | Vitest | 80%+ | All passing ✅ |
| **E2E Tests** | Playwright | 46 tests | All passing ✅ |
| **Load Tests** | Autocannon | 274K requests | 100% success ✅ |

**Key Achievements:**
- ✅ Handles 150+ concurrent students with 100% success rate
- ✅ Dashboard supports 90 concurrent users flawlessly
- ✅ Zero errors across 274,691 load test requests
- ✅ Average latency under 220ms for all scenarios

📊 **Full Results**: [Testing Documentation](docs/testing/overview.md)


## CI/CD Pipeline

### Continuous Integration

Automated validation on every pull request and push:

- ✅ **Linting**: JavaScript (ESLint), CSS (Stylelint), HTML (HTMLHint), Markdown
- ✅ **Testing**: Unit tests, E2E tests, load tests
- ✅ **Documentation**: JSDoc generation
- ✅ **Commit Validation**: Conventional commit format enforcement
- ✅ **Slack Notifications**: Automated status updates

### Continuous Deployment

- **Docker Builds**: All branches containerized with branch-specific tags
- **Production**: Only `main` branch deploys to Render with health checks
- **Infrastructure**: AWS CloudFormation (ECS cluster, ECR, networking)
- **Monitoring**: Automated health checks and rollback capability

📦 **Details**: [CI/CD Documentation](docs/deployment/ci-cd.md)


## Contributing

### Branching Strategy

- `main` - Production-ready code (protected, requires PR approval)
- `feature/[description]` - New features
- `bugfix/[description]` - Bug fixes  
- `docs/[description]` - Documentation updates
- `spec/[description]` - Specification documents

### Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Examples:
feat(attendance): add QR code generation
fix(auth): resolve session timeout issue
docs(api): update API documentation
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Pull Request Workflow

1. **Create branch** from `main`
2. **Implement changes** with tests
3. **Run quality checks**: `npm run lint && npm test`
4. **Submit PR** with conventional commit title
5. **Code review** by team members
6. **CI pipeline** must pass
7. **Merge to main** (auto-deploys to production)

### Code Standards

| Element | Convention | Example |
|---------|------------|---------|
| **Files** | kebab-case | `user-profile.js` |
| **Variables** | camelCase | `userName`, `isAuthenticated` |
| **Constants** | UPPER_SNAKE_CASE | `API_BASE_URL` |
| **Classes** | PascalCase | `UserManager` |
| **Functions** | camelCase | `getUserData()` |

📖 **Full Guidelines**: [Contributing Guide](docs/contributing/workflow.md)

## Team

### Sprint Process

- **Duration**: 1-week sprints
- **Standups**: Tuesdays & Thursdays via Slack bot
- **Reviews**: End of sprint (demo + retrospective)
- **Planning**: Start of sprint (story pointing + assignment)

### On-Call Rotation

- **Responsibility**: First responder for PRs and merge conflicts
- **Rotation**: Per sub-team, rotates each sprint

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **Slack**: Daily standups and quick questions
- **Wiki**: Team documentation and resources

## Environment Variables

Create a `.env` file with:

```env
# Server Configuration
PORT=8443
NODE_ENV=development
SESSION_SECRET=your-secret-key-min-32-chars

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/conductor

# Google OAuth 2.0
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8443/auth/google/callback

# Observability (Optional - for SigNoz integration)
SIGNOZ_ENDPOINT=http://localhost:4318
SERVICE_NAME=conductor-app
ENVIRONMENT=development
```

📖 **Setup Guide**: [Installation Documentation](docs/getting-started/installation.md)

## License

This project is part of UCSD CSE 210 coursework.  
© 2025 Team04-UCSD-CSE210

## Support & Resources

- 📖 [Documentation](docs/) - Comprehensive guides and references
- 🐛 [Issue Tracker](https://github.com/Team04-UCSD-CSE210/conductor-app/issues) - Report bugs
- 💬 [Project Wiki](https://github.com/Team04-UCSD-CSE210/conductor-app/wiki) - Team resources
- 🎓 [Course Page](https://ucsd.edu) - UC San Diego CSE 210

---

**Built with ❤️ by Team04 for UC San Diego CSE 210 Software Engineering**

