# 🚀 Server Setup & Deployment Guide

Complete guide for setting up, running, and deploying the Conductor Express.js API server.

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [API Documentation](#api-documentation)
- [Health Checks & Monitoring](#health-checks--monitoring)
- [Performance Optimization](#performance-optimization)
- [Security Configuration](#security-configuration)
- [Troubleshooting](#troubleshooting)
- [Scaling & High Availability](#scaling--high-availability)

---

## Prerequisites

Before setting up the server, ensure:

- **Node.js** 18+ installed
- **PostgreSQL database** running and initialized (see [LOCAL_DB_SETUP.md](./LOCAL_DB_SETUP.md))
- **npm** or **yarn** package manager
- **Environment variables** configured (`.env` file)

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Check npm version
npm --version

# Verify database is running
docker compose ps  # If using Docker
# OR
psql -U app -d conductor -c "SELECT 1;"  # If using local PostgreSQL
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp env.example .env
# Edit .env with your DATABASE_URL

# 3. Ensure database is running
docker compose up -d db  # If using Docker

# 4. Initialize database (if not already done)
npm run db:init
npm run db:seed

# 5. Start development server
npm start

# Server should be running on http://localhost:3000
```

✅ **Server is ready!** Test with: `curl http://localhost:3000/health`

---

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DATABASE_URL=postgresql://app:app_pw@localhost:5432/conductor

# Server Configuration
PORT=3000

# Optional: Debug Configuration
DEBUG_DB=false
NODE_ENV=development
```

### Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ Yes | - | PostgreSQL connection string |
| `PORT` | ❌ No | `3000` | Server listening port |
| `DEBUG_DB` | ❌ No | `false` | Enable database connection logging |
| `NODE_ENV` | ❌ No | `development` | Environment mode (`development`, `production`, `test`) |

### Connection String Format

```text
postgresql://[user]:[password]@[host]:[port]/[database]
```

**Examples:**

```env
# Docker (from host)
DATABASE_URL=postgresql://app:app_pw@localhost:5432/conductor

# Docker (from container)
DATABASE_URL=postgresql://app:app_pw@db:5432/conductor

# Local PostgreSQL
DATABASE_URL=postgresql://app:app_pw@localhost:5432/conductor

# Production (with SSL)
DATABASE_URL=postgresql://user:pass@db.example.com:5432/conductor?sslmode=require
```

### Environment-Specific Configuration

**Development:**

```env
DATABASE_URL=postgresql://app:app_pw@localhost:5432/conductor
PORT=3000
DEBUG_DB=true
NODE_ENV=development
```

**Production:**

```env
DATABASE_URL=postgresql://user:secure_password@prod-db.example.com:5432/conductor?sslmode=require
PORT=8080
NODE_ENV=production
```

---

## Development Setup

### Starting the Development Server

```bash
# Standard start
npm start

# With debug logging
DEBUG_DB=true npm start

# Custom port
PORT=4000 npm start
```

### Development Scripts

```bash
# Start server
npm start

# Run tests
npm run local:test

# Run linting
npm run lint

# Database operations
npm run db:init    # Initialize schema
npm run db:seed    # Seed demo data
npm run db:reset   # Reset database
npm run db:force   # Force re-run migrations

# Performance testing
npm run perf:db    # Database performance tests
npm run perf:api   # API performance tests
```

### Hot Reload (Recommended for Development)

Install `nodemon` for automatic server restarts:

```bash
npm install --save-dev nodemon
```

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "nodemon src/server.js"
  }
}
```

Run with:

```bash
npm run dev
```

### API Testing Tools

**Using curl:**

```bash
# Health check
curl http://localhost:3000/health

# Get users
curl http://localhost:3000/users?limit=10&offset=0

# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@ucsd.edu","role":"user"}'

# Get user by ID
curl http://localhost:3000/users/{user-id}

# Update user
curl -X PUT http://localhost:3000/users/{user-id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated"}'

# Delete user
curl -X DELETE http://localhost:3000/users/{user-id}
```

**Using HTTPie:**

```bash
# Install: brew install httpie (macOS) or pip install httpie
http GET localhost:3000/health
http GET localhost:3000/users limit==10 offset==0
http POST localhost:3000/users name=Alice email=alice@ucsd.edu role=user
```

**Using Postman/Insomnia:**

Import the API collection or manually test endpoints.

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL/TLS certificates configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Logging and monitoring set up
- [ ] Health checks configured
- [ ] Backup strategy in place

### Deployment Options

#### Option 1: PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start src/server.js --name conductor-api

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs conductor-api

# Restart
pm2 restart conductor-api

# Stop
pm2 stop conductor-api
```

**PM2 Ecosystem File (`ecosystem.config.js`):**

```javascript
module.exports = {
  apps: [{
    name: 'conductor-api',
    script: 'src/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

#### Option 2: Docker

**Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "src/server.js"]
```

**docker-compose.prod.yml:**

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NODE_ENV=production
      - PORT=3000
    depends_on:
      - db
    restart: unless-stopped
    networks:
      - conductor-network

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=conductor
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - conductor-network

volumes:
  pgdata:

networks:
  conductor-network:
    driver: bridge
```

**Deploy:**

```bash
docker compose -f docker-compose.prod.yml up -d
```

#### Option 3: Cloud Platforms

**Heroku:**

```bash
# Install Heroku CLI
heroku login

# Create app
heroku create conductor-api

# Set environment variables
heroku config:set DATABASE_URL=postgresql://...
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

**AWS Elastic Beanstalk:**

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init

# Create environment
eb create conductor-api-env

# Deploy
eb deploy
```

**Google Cloud Run:**

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/conductor-api
gcloud run deploy conductor-api \
  --image gcr.io/PROJECT_ID/conductor-api \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL=...
```

---

## API Documentation

### Base URL

- **Development:** `http://localhost:3000`
- **Production:** `https://api.conductor.example.com`

### Authentication

Currently, the API does not require authentication. In production, implement:

- JWT tokens
- API keys
- OAuth 2.0

### Endpoints

#### Health Check

```http
GET /health
```

**Response:**

```json
{
  "ok": true,
  "ts": "2025-01-15T10:30:00.000Z"
}
```

#### User Management

**List Users:**

```http
GET /users?limit=10&offset=0&role=user&status=active
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Maximum number of results |
| `offset` | integer | 0 | Number of results to skip |
| `role` | string | - | Filter by role (`user`, `admin`, `moderator`) |
| `status` | string | - | Filter by status (`active`, `disabled`, `archived`) |

**Response:**

```json
{
  "users": [
    {
      "id": "uuid",
      "name": "Alice Chen",
      "email": "alice@ucsd.edu",
      "role": "user",
      "status": "active",
      "created_at": "2025-01-15T10:00:00.000Z",
      "updated_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "total": 100,
  "limit": 10,
  "offset": 0
}
```

**Get User by ID:**

```http
GET /users/{id}
```

**Create User:**

```http
POST /users
Content-Type: application/json

{
  "name": "Alice Chen",
  "email": "alice@ucsd.edu",
  "role": "user",
  "status": "active"
}
```

**Update User:**

```http
PUT /users/{id}
Content-Type: application/json

{
  "name": "Alice Chen Updated",
  "role": "admin"
}
```

**Delete User:**

```http
DELETE /users/{id}
```

#### Roster Management

**Import Roster (JSON):**

```http
POST /users/roster/import/json
Content-Type: application/json

[
  {
    "name": "Student 1",
    "email": "student1@ucsd.edu",
    "role": "user"
  }
]
```

**Import Roster (CSV):**

```http
POST /users/roster/import/csv
Content-Type: multipart/form-data

file: [CSV file]
```

**Export Roster:**

```http
GET /users/roster/export/json
GET /users/roster/export/csv
```

**Rollback Import:**

```http
POST /users/roster/rollback
Content-Type: application/json

{
  "imported_ids": ["uuid1", "uuid2"]
}
```

### Error Responses

**400 Bad Request:**

```json
{
  "error": "Validation Error",
  "message": "Email must be a valid UCSD email address"
}
```

**404 Not Found:**

```json
{
  "error": "Not Found",
  "message": "User not found"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Internal Server Error",
  "message": "Database connection failed"
}
```

---

## Health Checks & Monitoring

### Health Check Endpoint

The `/health` endpoint provides basic health status:

```bash
curl http://localhost:3000/health
```

**Response:**

```json
{
  "ok": true,
  "ts": "2025-01-15T10:30:00.000Z"
}
```

### Enhanced Health Check

For production, implement a comprehensive health check:

```javascript
app.get('/health', async (_req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    status: 'ok',
    checks: {}
  };

  // Database check
  try {
    await pool.query('SELECT 1');
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### Monitoring Tools

**Application Performance Monitoring (APM):**

- **New Relic:** `npm install newrelic`
- **Datadog:** `npm install dd-trace`
- **Sentry:** `npm install @sentry/node`

**Logging:**

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

**Metrics Collection:**

```javascript
import promClient from 'prom-client';

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Performance Optimization

### Connection Pooling

The application uses `pg.Pool` for connection pooling. Configure in `src/db.js`:

```javascript
export const pool = new pg.Pool({
  connectionString: url,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 2000,
});
```

### Caching

Implement Redis caching for frequently accessed data:

```javascript
import redis from 'redis';

const client = redis.createClient({
  url: process.env.REDIS_URL
});

// Cache user lookups
async function getUser(id) {
  const cacheKey = `user:${id}`;
  const cached = await client.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const user = await UserModel.findById(id);
  await client.setEx(cacheKey, 3600, JSON.stringify(user));
  return user;
}
```

### Rate Limiting

Rate limiting is implemented via `src/middleware/rate-limiter.js`:

```javascript
import { apiLimiter } from './middleware/rate-limiter.js';

app.use('/api', apiLimiter);
```

### Compression

Enable response compression:

```bash
npm install compression
```

```javascript
import compression from 'compression';

app.use(compression());
```

### Load Balancing

Use a reverse proxy (Nginx) for load balancing:

```nginx
upstream conductor_api {
    least_conn;
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    server_name api.conductor.example.com;

    location / {
        proxy_pass http://conductor_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Security Configuration

### Security Headers

Install and configure `helmet`:

```bash
npm install helmet
```

```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
```

### CORS Configuration

Configure CORS for production:

```javascript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
```

### Input Validation

Use validation middleware:

```bash
npm install express-validator
```

```javascript
import { body, validationResult } from 'express-validator';

app.post('/users', [
  body('email').isEmail().normalizeEmail(),
  body('name').trim().isLength({ min: 2 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Process request
});
```

### SQL Injection Prevention

Always use parameterized queries (already implemented via `pg`):

```javascript
// ✅ Good
await pool.query('SELECT * FROM users WHERE email = $1', [email]);

// ❌ Bad
await pool.query(`SELECT * FROM users WHERE email = '${email}'`);
```

---

## Troubleshooting

### Server Won't Start

**Error: `DATABASE_URL not defined`**

- Check `.env` file exists and contains `DATABASE_URL`
- Verify environment variables are loaded: `console.log(process.env.DATABASE_URL)`

**Error: `Database connection failed`**

- Verify database is running: `docker compose ps`
- Check connection string format
- Test connection: `psql $DATABASE_URL`

**Error: `Port already in use`**

```bash
# Find process using port
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process or use different port
PORT=4000 npm start
```

### API Errors

**404 Not Found:**

- Verify route paths match exactly
- Check Express route registration order
- Ensure middleware is applied correctly

**500 Internal Server Error:**

- Check server logs for detailed error messages
- Verify database connectivity
- Check for unhandled promise rejections

### Performance Issues

**Slow Response Times:**

- Check database query performance
- Monitor connection pool usage
- Review application logs for bottlenecks
- Use APM tools to identify slow endpoints

**High Memory Usage:**

- Review connection pool size
- Check for memory leaks
- Monitor with `node --inspect`
- Use `clinic.js` for profiling

---

## Scaling & High Availability

### Horizontal Scaling

Run multiple server instances behind a load balancer:

```bash
# Using PM2 cluster mode
pm2 start src/server.js -i max

# Using Docker Compose
docker compose up --scale api=3
```

### Database Scaling

- **Read Replicas:** Configure PostgreSQL read replicas for read-heavy workloads
- **Connection Pooling:** Use PgBouncer for connection pooling
- **Sharding:** Partition data across multiple databases if needed

### High Availability

- **Health Checks:** Implement comprehensive health checks
- **Graceful Shutdown:** Handle SIGTERM signals properly
- **Circuit Breakers:** Implement circuit breakers for external dependencies
- **Retry Logic:** Add retry logic for transient failures

---

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [12-Factor App Methodology](https://12factor.net/)

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review server logs
3. Check GitHub Issues
4. Contact the development team

---

**Last Updated:** 2025-11-06 
**Maintained by:** Bhavik
