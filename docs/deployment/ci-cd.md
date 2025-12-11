# CI/CD Pipeline

Continuous Integration and Continuous Deployment for Conductor.

## Overview

Conductor uses **GitHub Actions** for automated CI/CD:

- Automated testing on every commit
- Linting and code quality checks
- Automated deployment to production
- Slack notifications for build status
- Docker image building and publishing

## Pipeline Architecture

```mermaid
flowchart LR
    A[Git Push] --> B[GitHub Actions]
    B --> C{Branch?}
    C -->|Feature| D[Lint + Test]
    C -->|Main| E[Lint + Test + Deploy]
    D --> F[PR Review]
    F --> G[Merge to Main]
    G --> E
    E --> H[Build Docker Image]
    H --> I[Deploy to Render]
    I --> J[Health Check]
    J --> K[Notify Slack]
```

## GitHub Actions Workflows

### 1. CI Workflow

**File**: `.github/workflows/ci.yml`

**Triggers**:
- Push to any branch
- Pull request to main

**Jobs**:

#### Lint Job
```yaml
lint:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run lint
```

**Checks**:
- ESLint (JavaScript)
- Stylelint (CSS)
- HTMLHint (HTML)
- Markdownlint (Markdown)

#### Unit Test Job
```yaml
unit-tests:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:18
      env:
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: conductor_test
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - run: npm ci
    - run: npm run db:init
    - run: npm run test:unit -- --coverage
    - uses: codecov/codecov-action@v3
      with:
        files: ./coverage/coverage-final.json
```

#### E2E Test Job
```yaml
e2e-tests:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:18
      # ... same as above
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - run: npm ci
    - run: npx playwright install chromium
    - run: npm run db:seed
    - run: npm run test:e2e:chromium
    - uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

### 2. CD Workflow

**File**: `.github/workflows/cd.yml`

**Triggers**:
- Push to `main` branch only

**Jobs**:

#### Build Docker Image
```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to GitHub Container Registry
      uses: docker/login-action@v2
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: |
          ghcr.io/${{ github.repository }}:latest
          ghcr.io/${{ github.repository }}:${{ github.sha }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

#### Deploy to Render
```yaml
deploy:
  needs: build
  runs-on: ubuntu-latest
  steps:
    - name: Trigger Render Deployment
      run: |
        curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}
    
    - name: Wait for deployment
      run: sleep 60
    
    - name: Health check
      run: |
        response=$(curl -s -o /dev/null -w "%{http_code}" https://conductor-app.onrender.com/health)
        if [ $response -eq 200 ]; then
          echo "[OK] Health check passed"
        else
          echo "[X] Health check failed with status $response"
          exit 1
        fi
```

#### Notify Slack
```yaml
notify:
  needs: deploy
  runs-on: ubuntu-latest
  if: always()
  steps:
    - name: Slack Notification
      uses: slackapi/slack-github-action@v1
      with:
        webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
        payload: |
          {
            "text": "Deployment ${{ job.status }}",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": " *Conductor Deployment*\nStatus: ${{ job.status }}\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}"
                }
              }
            ]
          }
```

## Environment Variables

### Required Secrets

Configure in GitHub repo settings → Secrets and variables → Actions:

| Secret | Purpose | Example |
|--------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SESSION_SECRET` | Express session secret | Random 32-char string |
| `GOOGLE_CLIENT_ID` | OAuth client ID | From Google Console |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | From Google Console |
| `RENDER_DEPLOY_HOOK` | Render deploy webhook | `https://api.render.com/deploy/...` |
| `SLACK_WEBHOOK_URL` | Slack notification webhook | `https://hooks.slack.com/...` |

### Environment-Specific Variables

**Development** (`.env`):
```bash
NODE_ENV=development
PORT=8443
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/conductor
SESSION_SECRET=dev-secret-change-in-production
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:8443/auth/google/callback
```

**Production** (Render/AWS):
```bash
NODE_ENV=production
PORT=443
DATABASE_URL=postgresql://...@aws-rds-instance:5432/conductor_prod
SESSION_SECRET=<strong-random-string>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://conductor-app.onrender.com/auth/google/callback
```

## Deployment Targets

### Render (Current)

**Configuration** (`render.yaml`):
```yaml
services:
  - type: web
    name: conductor-app
    env: node
    region: oregon
    plan: starter
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: conductor-db
          property: connectionString
      - key: SESSION_SECRET
        generateValue: true
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
    healthCheckPath: /health

databases:
  - name: conductor-db
    databaseName: conductor
    plan: starter
```

**Deployment Process**:
1. Push to `main` branch
2. GitHub Actions builds Docker image
3. Render webhook triggered
4. Render pulls latest image
5. Zero-downtime deployment
6. Health check validates deployment

**Render Dashboard**: https://dashboard.render.com

### AWS ECS (Alternative)

**Infrastructure** (CloudFormation):
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  ConductorCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: conductor-cluster
  
  ConductorTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: conductor-task
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      Cpu: 256
      Memory: 512
      ContainerDefinitions:
        - Name: conductor-app
          Image: ghcr.io/team04-ucsd-cse210/conductor-app:latest
          PortMappings:
            - ContainerPort: 8443
          Environment:
            - Name: NODE_ENV
              Value: production
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: /ecs/conductor
              awslogs-region: us-west-2
              awslogs-stream-prefix: ecs
```

**Deployment Command**:
```bash
aws ecs update-service \
  --cluster conductor-cluster \
  --service conductor-service \
  --force-new-deployment
```

## Monitoring and Observability

### Health Checks

**Endpoint**: `GET /health`

**Response**:
```json
{
  "ok": true,
  "timestamp": "2025-12-10T10:00:00Z",
  "uptime": 86400,
  "environment": "production",
  "version": "1.2.0"
}
```

**Monitoring Frequency**:
- Render: Every 30 seconds
- AWS ECS: Every 10 seconds
- GitHub Actions: After deployment

### Logging

**Application Logs**:
```javascript
// src/utils/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

export default logger;
```

**Usage**:
```javascript
import logger from './utils/logger.js';

logger.info('Server started', { port: 8443 });
logger.error('Database connection failed', { error: err.message });
```

### Metrics (OpenTelemetry + SigNoz)

See [Monitoring Documentation](monitoring.md) for details.

## Rollback Procedures

### Render Rollback

1. Go to Render Dashboard
2. Navigate to conductor-app service
3. Click "Events" tab
4. Find previous successful deployment
5. Click "Rollback to this deploy"

**Or via CLI**:
```bash
render services rollback conductor-app --to-deploy <deploy-id>
```

### AWS ECS Rollback

```bash
# Get previous task definition
aws ecs describe-task-definition \
  --task-definition conductor-task:1

# Update service to use previous version
aws ecs update-service \
  --cluster conductor-cluster \
  --service conductor-service \
  --task-definition conductor-task:1
```

### GitHub Actions Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or force push previous commit
git reset --hard HEAD~1
git push --force origin main
```

## Performance Optimization

### Docker Image Optimization

**Multi-stage Build**:
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 8443
CMD ["node", "src/server.js"]
```

**Size Reduction**:
- Base image: `node:18-alpine` (173 MB vs 1.1 GB)
- Multi-stage build reduces final size by 60%
- `.dockerignore` excludes unnecessary files

### CDN Integration

**Static Assets** (Future):
```javascript
// Serve static files from CDN
const CDN_URL = process.env.CDN_URL || '';

app.use('/static', express.static('public', {
  maxAge: '1y',
  setHeaders: (res, path) => {
    if (CDN_URL) {
      res.setHeader('Access-Control-Allow-Origin', CDN_URL);
    }
  }
}));
```

## Security

### Secrets Management

**Never commit**:
- `.env` files
- API keys
- Database passwords
- OAuth secrets

**Use**:
- GitHub Secrets for CI/CD
- Render Environment Variables
- AWS Secrets Manager (for AWS deployments)

### Dependency Scanning

**Automated Security Checks**:
```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm audit
      - run: npm audit fix
```

### SSL/TLS

- [OK] Render provides free SSL certificates
- [OK] Automatic HTTPS redirect
- [OK] HSTS headers enabled

## Troubleshooting

### Deployment Failed

**Check GitHub Actions logs**:
1. Go to repository → Actions tab
2. Click failed workflow
3. Expand failed job
4. Review error logs

**Common Issues**:
- Build errors → Fix code and push
- Test failures → Fix tests locally first
- Deploy hook timeout → Check Render status

### Application Won't Start

**Check Render logs**:
```bash
# Via Render CLI
render logs conductor-app --tail 100
```

**Common Causes**:
- Missing environment variables
- Database connection failure
- Port binding issues

### Database Migration Failed

**Manual Migration**:
```bash
# SSH into Render container
render shell conductor-app

# Run migrations
npm run db:init
# Or with seed data
npm run db:seed
```

## Best Practices

### Commit Messages

Follow Conventional Commits:
```
feat: add user profile editing
fix: resolve session timeout bug
docs: update API documentation
test: add unit tests for validators
chore: update dependencies
```

### Pull Request Workflow

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and commit
3. Push to GitHub: `git push origin feature/new-feature`
4. Create Pull Request
5. Wait for CI checks to pass
6. Request review from team
7. Merge to main after approval

### Deployment Schedule

- **Hotfixes**: Immediate deployment
- **Features**: Deploy during low-traffic hours
- **Major updates**: Schedule maintenance window

---

**See Also:**
- [Docker Documentation](docker.md)
- [Production Guide](production.md)
- [Monitoring Documentation](monitoring.md)
- [Testing Overview](../testing/overview.md)
