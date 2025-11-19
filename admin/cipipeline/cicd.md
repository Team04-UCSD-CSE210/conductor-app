# CI/CD Pipeline Status Report — Conductor App

This document describes current status of the **CI/CD pipeline** of team four's Conductor App. The CI/CD pipeline
ensures that each developer on the team can validate code changes by automatically linting, testing, documenting,
and deploying the project upon every push or pull request.

The CI and CD pipelines are implemented using **GitHub Actions**, and the diagram of the workflow (`cicd.png`) is
included in this directory.

---

## 1. Overview

The CI pipeline is defined in:

```yaml
.github/workflows/ci-pipeline.yml
```

It is triggered on:

- **Every push** (`push: ["**"]`)
- **Every pull request** (`pull_request: ["**"]`)

For every push (to a branch) and pull request (to main) a change can be automatically tested and deployed.

The CI pipeline includes the following jobs:

1. `commit-lint` — validate commit message style
2. `lint` — run style and static analysis checks
3. `test` — run automated tests using PostgreSQL
4. `docker-build` — validate containerization
5. `docs` — generate documentation with JSDoc
6. `security` — run security audit and secret scanning
7. `notify` — send Slack notifications with build results

The pipeline is designed as a way to make changes such that it must before being merged and keeps quality checks
throughout the development process

A separate CD pipeline is defined in:

```yaml
.github/workflows/cd-pipeline.yml
```

It is also triggered on evey push and pull request in order to:

- Building a Docker image of the application
- Pushing the image to **Amazon ECR**
- Deploying/updating **ECS Fargate** services inside an AWS VPC
- Running health checks and providing deployment feedback on pull requests
- Expose the URL

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

Runs multiple linters to enforce code style:

- **ESLint** for JavaScript
- **Stylelint** for CSS
- **HTMLHint** for HTML

This catches style violations and potential bugs before they reach production.

---

### 3.3 Testing (`test`)

Runs the full test suite against a **real PostgreSQL database**.

Coverage:

- Enforces **minimum 80%** code coverage
- Fails the job if coverage drops

This ensures database queries and backend logic behave correctly against a real DB instance.

---

### 3.4 Documentation Generation (`docs`)

Runs:

```bash
npm run docs
```

which executes:

```bash
jsdoc -d docs .
```

This automatically regenerates API documentation on every push.
This satisfies **"Documentation generation via automation (ex. JSDocs)"** from the assignment.

---

### 3.5 Docker Build (`docker-build`)

Validates containerization by building the Docker image:

This ensures the application can be successfully containerized before deployment.

---

### 3.6 Security (`security`)

Performs security auditing and secret scanning:

This job:

- Audits npm dependencies for high-severity vulnerabilities
- Scans for exposed secrets (API keys, passwords, tokens) in pull requests
- Uses TruffleHog for comprehensive secret detection

---

### 3.7 Slack Notifications (`notify`)

This job runs **even if other jobs fail**.

It sends a message to Slack containing:

- Build status
- Commit SHA
- Repository name
- A link to the GitHub Actions run

This enables quick feedback for the team.

---

## 4. Detailed Description of CI Pipeline

In addition to CI, the repository defines an automated CD workflow:

- **Workflow file**: `.github/workflows/cd-pipeline.yml`
- **Platform**: AWS (CloudFormation, ECR, ECS Fargate, VPC, CloudFront)

High-level flow:

### 4.1 Infrastructure via CloudFormation (main branch only)

- On pushes to `main`, the workflow deploys/updates a CloudFormation stack that manages:
  - VPC and networking (public subnets, security group)
  - ECS cluster
  - ECR repository
  - RDS PostgreSQL database
  - CloudFront distribution with URL: `https://dfbhtda4vdu81.cloudfront.net`
- Stack outputs (cluster name, repository URI, subnet IDs, security group) are exported and reused by later steps.

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
  - Sets `FEATURE_URL=http://{public-ip}:3001`

### 4.5 Health Checks and Rollback

- After deployment, the workflow performs health checks:
  - **Main branch**: `https://dfbhtda4vdu81.cloudfront.net/health`
  - **Feature branches**: `http://{extracted-ip}:3001/health`
  - **Retry logic**: 5 attempts with 30-second intervals
- If health check fails:
  - The workflow locates the previous **PRIMARY** task definition
  - Rolls the service back to the previous version
  - If no previous deployment exists, scales service to zero tasks

### 4.6 Feedback to Pull Requests

- For pull requests, the workflow posts a comment using `actions/github-script@v7`:
  - **Branch name** and **service name**
  - **Deployment URL**:
    - `main` branch: `https://dfbhtda4vdu81.cloudfront.net`
    - Feature branches: `http://{public-ip}:3001`
- **Slack notifications** are sent regardless of job status with:
  - Deployment status (SUCCESSFUL/FAILED)
  - Branch and service information
  - Deployment URL

This CD structure complements the CI pipeline, providing automated deployment to AWS with branch isolation, health
monitoring, and automatic rollback capabilities.

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

- **GitHub Actions CI pipeline** with 7 jobs:
  - Multi-language linting (ESLint, Stylelint, HTMLHint)
  - Automated tests with PostgreSQL 15 service
  - Docker build validation
  - JSDoc documentation generation
  - Conventional commit message validation
  - Security audit and secret scanning (TruffleHog)
  - Slack notifications with build results
- **Complete pull-request workflow** with automated checks
- **GitHub Actions CD pipeline** that:
  - Deploys CloudFormation infrastructure (main branch only)
  - Builds and pushes Docker images to Amazon ECR with branch-specific tags
  - Deploys to AWS ECS Fargate services with branch isolation
  - Provides feature branch access via public IP resolution
  - Runs health checks with 5-retry logic and 30-second intervals
  - Automatically rolls back to previous PRIMARY task definition on failure
  - Comments on pull requests with deployment status and URLs
  - Sends Slack notifications for all deployment events
- **Production deployment** via CloudFront: `https://dfbhtda4vdu81.cloudfront.net`
- **Feature branch deployments** with isolated ECS services: `conductor-{branch-name}`

### Planned / Future Improvements

(Not required for this submission but aligned with course suggestions.)

- Ensure that all pages work with deployment on AWS
- External code quality integration (CodeClimate / SonarCloud)
- Coverage reporting (Codecov / Coveralls)
- End-to-end testing (Playwright or Cypress)
- Docker-based integration tests
- **Automatic cleanup of branch-specific ECS services and ECR images for stale branches**
- **Database migration automation**
- **Blue-green deployment strategy**

---

## 7. Summary

This CI/CD pipeline satisfies the course requirements by providing:

1. **Automated CI** that runs on every push/PR.
2. **Multi-language linting** (JavaScript, CSS, HTML).
3. **Automated testing** with real database integration.
4. **Documentation generation** via JSDoc.
5. On push/PR, the CD workflow builds Docker images with branch-specific tags, deploys to AWS ECS Fargate with
   branch isolation (conductor-{branch-name} services), performs health checks with 5-retry logic, automatically
   rolls back on failure, and posts deployment status with URLs as PR comments and Slack notifications.

This fully supports the course goal of enabling quick and frequent builds and deployments.

The implementation demonstrates a production-ready CI/CD pipeline that balances automation with quality gates,
ensuring reliable software delivery while maintaining development velocity.
