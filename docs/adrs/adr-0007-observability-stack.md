# ADR-0007: Observability Stack Selection

## Status

Accepted

## Context

The Conductor application requires comprehensive observability to monitor performance, debug issues, and track business metrics in production. The system needs to:

- Track HTTP request metrics (latency, throughput, errors)
- Monitor database query performance
- Trace requests across the application stack
- Capture business metrics (logins, journal entries, attendance)
- Provide real-time dashboards for system health
- Support debugging of production issues
- Scale with the application (100-200 concurrent users)

Key requirements:
- **Low overhead**: Minimal performance impact (<5% latency increase)
- **Auto-instrumentation**: Capture standard metrics without manual instrumentation
- **Custom metrics**: Support application-specific business metrics
- **Open standards**: Vendor-neutral telemetry format
- **Cost-effective**: Affordable for educational/startup budget
- **Self-hosted option**: Ability to run locally for development
- **Production-ready**: Proven reliability at scale

## Decision

We will use **OpenTelemetry SDK** for instrumentation and **SigNoz** as the observability backend.

**Technology Stack:**
- **Instrumentation**: OpenTelemetry SDK for Node.js with auto-instrumentation
- **Protocol**: OTLP (OpenTelemetry Protocol) over HTTP
- **Backend**: SigNoz (open-source APM platform)
- **Storage**: ClickHouse (embedded in SigNoz)
- **Deployment**: Docker Compose (local), SigNoz Cloud (production)

**Integration Points:**
1. `src/instrumentation.js` - OpenTelemetry SDK initialization (loaded FIRST)
2. `src/middleware/metrics-middleware.js` - Custom metrics middleware
3. `src/server.js` - Application entry point with instrumentation import

**Metrics Tracked:**
- **HTTP**: Request count, duration, status codes (auto-instrumented)
- **Database**: Query count, latency, slow queries (auto-instrumented)
- **Business**: Logins, journal entries, attendance records (custom metrics)
- **System**: Memory usage, event loop utilization, active handles

## Consequences

### Positive

- **Open Standard**: OpenTelemetry is vendor-neutral and future-proof
- **Auto-instrumentation**: HTTP, PostgreSQL, and file system instrumentation work out-of-the-box
- **Zero code changes**: Instrumentation imported at startup, no changes to route handlers
- **Rich context**: Distributed tracing provides full request lifecycle visibility
- **Cost-effective**: SigNoz open-source allows self-hosting; cloud tier affordable
- **Developer experience**: Local Docker setup identical to production
- **Unified telemetry**: Single platform for metrics, traces, and logs
- **Performance**: <2% overhead in benchmarks, negligible latency impact
- **Community support**: Active OpenTelemetry and SigNoz communities

### Negative

- **Learning curve**: Team needs to learn OpenTelemetry concepts and SigNoz UI
- **Infrastructure overhead**: SigNoz requires Docker Compose (7+ containers) for local dev
- **Memory footprint**: OpenTelemetry SDK adds ~30-50MB to Node.js process
- **Vendor lock-in risk**: SigNoz-specific dashboards not portable (though OTLP is standard)
- **Limited alerting**: SigNoz alerting less mature than DataDog/New Relic
- **Query language**: ClickHouse SQL less familiar than Prometheus PromQL

### Neutral

- **Configuration complexity**: Requires environment variables for SigNoz endpoint and token
- **Development workflow**: Local SigNoz stack optional (can disable instrumentation)
- **Data retention**: Need to configure retention policies for production (default 7 days)
- **Export formats**: OTLP standard, but migration to other backends requires testing

## Alternatives Considered

### 1. **Prometheus + Grafana**
**Pros:**
- Industry standard for metrics
- Powerful PromQL query language
- Extensive Grafana visualization options
- Free and open-source

**Cons:**
- Requires separate tools for tracing (Jaeger/Tempo)
- More complex setup (3+ services: Prometheus, Grafana, Jaeger)
- Manual instrumentation needed for custom metrics
- No auto-instrumentation for Node.js without prom-client library
- Steeper learning curve for team

**Rejected**: Too complex for our scale; lacks unified metrics + traces solution

### 2. **DataDog**
**Pros:**
- Best-in-class APM with rich features
- Excellent auto-instrumentation
- Superior alerting and anomaly detection
- Great documentation and support

**Cons:**
- **Cost prohibitive**: $15-31/host/month + data ingestion fees
- Vendor lock-in (proprietary agent)
- Requires external service (no self-hosting)
- Overkill for 100-200 user application

**Rejected**: Too expensive for educational project budget

### 3. **New Relic**
**Pros:**
- Comprehensive APM features
- Good free tier (100GB/month data)
- Auto-instrumentation for Node.js
- Strong error tracking

**Cons:**
- Proprietary agent (vendor lock-in)
- Free tier limits insufficient for production
- Paid tier expensive ($99+/month)
- No self-hosting option

**Rejected**: Vendor lock-in risk and cost concerns

### 4. **Elastic APM (ELK Stack)**
**Pros:**
- Integrated with Elasticsearch for logs
- Powerful search and analysis
- Open-source option available

**Cons:**
- Heavy resource requirements (ElasticSearch is memory-intensive)
- Complex setup and maintenance
- Requires Elasticsearch expertise
- Slower query performance than ClickHouse for time-series data

**Rejected**: Too resource-intensive and complex for our needs

### 5. **Custom Metrics + Console Logging**
**Pros:**
- Zero external dependencies
- Full control over implementation
- No cost

**Cons:**
- No distributed tracing
- Limited visualization options
- Manual instrumentation everywhere
- Difficult to debug production issues
- No historical data analysis

**Rejected**: Insufficient for production-grade observability

## Implementation Notes

### Configuration

**Environment Variables:**
```bash
SIGNOZ_ENDPOINT=https://ingest.{region}.signoz.cloud:443  # Production
# OR
SIGNOZ_ENDPOINT=http://localhost:4318                      # Local development

SIGNOZ_ACCESS_TOKEN=<your-token>  # Required for SigNoz Cloud
SERVICE_NAME=conductor-app
ENVIRONMENT=production  # or development, staging
```

**Instrumentation Order (Critical):**
```javascript
// src/server.js
import './instrumentation.js';  // MUST be first import
import express from 'express';
// ... rest of imports
```

### Local Development Setup

```bash
# Clone SigNoz
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy

# Start SigNoz stack (7 containers)
docker-compose -f docker/clickhouse-setup/docker-compose.yaml up -d

# Access UI at http://localhost:3301
```

**Optional**: Set `SIGNOZ_ENDPOINT=""` to disable instrumentation during development.

### Custom Metrics Examples

```javascript
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('conductor-app');
const loginCounter = meter.createCounter('user.logins');

// Track login
loginCounter.add(1, { status: 'success' });

// Track attendance
const attendanceCounter = meter.createCounter('attendance.records');
attendanceCounter.add(1, { status: 'present' });
```

### Migration Steps

1. Install dependencies: `npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node`
2. Create `src/instrumentation.js` with OpenTelemetry setup
3. Import instrumentation FIRST in `src/server.js`
4. Add custom metrics middleware
5. Configure environment variables
6. Test locally with Docker SigNoz
7. Deploy to SigNoz Cloud for production

### Monitoring Dashboards

**Key Dashboards to Create:**
- **Application Overview**: Request rate, latency, error rate (RED metrics)
- **Database Performance**: Query count, slow queries, connection pool usage
- **Business Metrics**: Logins/day, journal entries, attendance trends
- **System Health**: Memory, CPU, event loop lag, active connections

## Related Decisions

- [ADR-0004: Server Selection](adr-0004-server-selection.md) - Node.js + Express stack
- [ADR-0002: Database Selection](adr-0002-database-selection.md) - PostgreSQL auto-instrumentation

## Date

November 2025

## Participants

- Development Team
- DevOps Engineer
- Product Owner
