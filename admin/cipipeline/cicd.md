# CI/CD Pipeline Status Report — Conductor App

This document describes current status of the **CI/CD pipeline** of team four's Conductor App.
The CI/CD pipeline ensures that each developer on the team can validate code changes by
automatically linting, testing, documenting, and deploying the project upon every push or pull request.

---

## 1. Overview

The CI pipeline is defined in:

```yaml
.github/workflows/ci-pipeline.yml
```

It is triggered on:

- **Every push** (`push: ["**"]`)
- **Every pull request** (`pull_request: ["**"]`)

The CI pipeline includes the following jobs:

1. `commit-lint` — validate commit message style
2. `lint` — run style and static analysis checks
3. `test` — run automated tests using PostgreSQL
4. `docker-build` — validate containerization
5. `docs` — generate documentation with JSDoc
6. `security` — run security audit and secret scanning
7. `notify` — send Slack notifications with build results

The CD pipeline is defined in:

```yaml
.github/workflows/cd-pipeline.yml
```

It is also triggered on:

- **Every push** (`push: ["**"]`)
- **Every pull request** (`pull_request: ["**"]`)

The CD pipeline includes the following jobs:

- Building a Docker image of the application
- Pushing the image to **Amazon ECR**
- Deploying/updating **ECS Fargate** services inside an AWS VPC
- Running health checks and providing deployment feedback on pull requests
- Exposing the URL

---

## 2. Diagram

The diagram presented within this directory includes both the CI pipeline and the CD pipeline.

[cicd.png](cicd.png)

---

## 3. Detailed Description of CI Pipeline

### 3.1 Commit Linting (`commit-lint`)

Ensures commit messages follow the **Conventional Commits** format.

**Example valid commit messages:**

- `feat: add user authentication`
- `fix: resolve login timeout issue`
- `docs: update API documentation`

**Example invalid commit messages:**

- `added some stuff`
- `Fixed bug`
- `Update`

This enforces consistency and enables automated changelog generation.

---

### 3.2 Linting (`lint`)

Runs multiple linters to enforce code style. This catches style violations and potential bugs
before they reach production.

---

### 3.3 Testing (`test`)

Runs the full test suite against a **real PostgreSQL database**. Enforces **minimum 80%**
code coverage.

This ensures database queries and backend logic behave correctly against a real DB instance.

---

### 3.4 Documentation Generation (`docs`)

Runs:

```bash
npm run docs
```

This automatically regenerates documentation on the command push.

---

### 3.5 Docker Build (`docker-build`)

Validates containerization by building the Docker image.

This ensures the application can be successfully containerized before deployment.

---

### 3.6 Security (`security`)

Performs security auditing and secret scanning:

- Audits npm dependencies for high-severity vulnerabilities
- Scans for exposed secrets (API keys, passwords, tokens) in pull requests
- Uses TruffleHog for comprehensive secret detection

---

### 3.7 Slack Notifications (`notify`)

This job runs **even if other jobs fail**.

It sends a message to Slack containing:

- Build status
- Repository name
- A link to the GitHub Actions run

This enables quick feedback for the team.

---

## 4. Detailed Description of CD Pipeline

### 4.1 Infrastructure via CloudFormation (main branch only)

- On pushes to `main`, the workflow deploys/updates a CloudFormation stack
  - With the CloudFront distribution with URL: `https://dfbhtda4vdu81.cloudfront.net`
- Stack outputs (cluster name, repository URI, subnet IDs, security group) are exported and
  reused by later steps.

### 4.2 Build / Package Image

- For all branches and pull requests:
  - Log in to Amazon ECR using `aws-actions/amazon-ecr-login@v2`
  - Build a Docker image for the application:
    - `docker build -t $ECR_REGISTRY/conductor-app:$IMAGE_TAG .`
  - Push the image to ECR with a **branch-specific tag** (`{clean-branch}-{github-sha}`).

### 4.3 Deploy to ECS Fargate

- The workflow creates a dynamic task definition from `aws-task-definition.json` template
- Environment variables are injected:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`
  - `GOOGLE_CALLBACK_URL` (branch-specific)
- It then **creates or updates** an ECS Fargate service:
  - `SERVICE_NAME = conductor-{clean-branch}` for all branches
  - The service runs in the CloudFormation-managed VPC using configured subnets and security group
  - **Desired count**: 1 task
  - **Public IP**: Enabled for feature branch access

### 4.4 Feature Branch IP Resolution

- For non-main branches, the workflow:
  - Waits 30 seconds for service startup
  - Retrieves the running task ARN
  - Extracts the public IP from the network interface

### 4.5 Health Checks and Rollback

- After deployment, the workflow performs health checks.
- If health check fails:
  - The workflow locates the previous **PRIMARY** task definition
  - Rolls the service back to the previous version
  - If no previous deployment exists, scales service to zero tasks

### 4.6 Feedback to Pull Requests

- For pull requests, the workflow posts a comment
- **Slack notifications** are sent regardless of job status with:
  - Deployment status (SUCCESSFUL/FAILED)
  - Branch and service information
  - Deployment URL

---

## 5. Code Quality via Human Review

In addition to automated checks, the project includes:

- Pull request workflow
- A detailed PR template (`.github/pull_request_template.md`)
- Requirements for:
  - Connect the AWS Deployment to the CI/CD Pipeline
  - Code review before merge
  - All CI checks must pass

---

## 6. Current Status Summary

### Fully Implemented

- **GitHub Actions CI pipeline**:
  - Multi-language linting (ESLint, Stylelint, HTMLHint)
  - Automated tests with PostgreSQL 15 service
  - Docker build validation
  - JSDoc documentation generation
  - Conventional commit message validation
  - Security audit and secret scanning (TruffleHog)
  - Slack notifications with build results
- **GitHub Actions CD pipeline**:
  - Deploys CloudFormation infrastructure (main branch only)
  - Builds and pushes Docker images to Amazon ECR with branch-specific tags
  - Deploys to AWS ECS Fargate services with branch isolation
  - Provides feature branch access via public IP resolution
  - Runs health checks with 5-retry logic and 30-second intervals
  - Automatically rolls back to previous PRIMARY task definition on failure
  - Comments on pull requests with deployment status and URLs
  - Sends Slack notifications for all deployment events
- **Production deployment** via CloudFront: `https://dfbhtda4vdu81.cloudfront.net`
- **Feature branch deployments** with isolated ECS services
- **Complete pull-request workflow** with automated checks

### Planned / Future Improvements

- Ensure that all pages work with deployment on AWS
- External code quality integration (CodeClimate / SonarCloud)
- Coverage reporting (Codecov / Coveralls)
- End-to-end testing (Playwright or Cypress)
- Docker-based integration tests
- Database migration automation
