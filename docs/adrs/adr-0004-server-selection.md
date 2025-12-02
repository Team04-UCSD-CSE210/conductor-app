# ADR-0004: Server Framework Selection (Express.js)

## Status

Accepted

## Context

The Conductor App requires a Node.js server framework to handle HTTP requests and
serve our RESTful API. The key requirements for the server framework include:

- **RESTful API Support**: Must efficiently handle multiple API endpoints for users,
enrollments, teams, attendance, and other resources
- **Middleware Architecture**: Need flexible middleware support for authentication,
authorization, rate limiting, and request processing
- **Session Management**: Must integrate well with session stores for user authentication state
- **Authentication Integration**: Should work seamlessly with Passport.js for Google OAuth 2.0
- **Performance**: Fast request/response handling with minimal overhead for a classroom
management system serving 50-100 concurrent users
- **Developer Experience**: Easy to learn with good documentation, as our team has varying
levels of backend experience
- **Ecosystem**: Large community and rich ecosystem of plugins/middleware for common tasks
- **Deployment Flexibility**: Must support both local HTTPS development and
cloud deployments (Vercel, AWS)

We evaluated three main options for our Node.js server framework:

1. **Express.js** - Minimal, unopinionated web framework
2. **Fastify** - High-performance framework with built-in schema validation
3. **NestJS** - Opinionated, TypeScript-first framework with dependency injection

## Decision

We chose **Express.js (version 4.21.2)** as our server framework.

### Rationale

**Why Express.js:**

1. **Simplicity & Learning Curve**: Express has a minimal, straightforward API that our team
can learn quickly. Most developers already have some familiarity with
Express, reducing onboarding time.

2. **Flexibility**: Express is unopinionated, allowing us to structure our application
as needed. We organized our code into clear
layers (routes, services, middleware) without framework constraints.

3. **Integration Support**: Express has first-class integration with all our required libraries:
   - Passport.js for OAuth authentication
   - PostgreSQL via node-postgres (pg)
   - Express-session for session management
   - Multer for CSV file uploads

4. **Community & Documentation**: Extensive documentation, tutorials,
and StackOverflow answers available. Strong community support reduces development friction.

5. **Production-Ready**: Express powers many large-scale applications and has proven
stability and reliability.

**Why Not Fastify:**

- While Fastify offers better raw performance (~20-30% faster), our classroom management
system doesn't require extreme performance optimization
- Fastify's schema-first approach adds complexity that isn't necessary for our use case
- Smaller ecosystem and less team familiarity

**Why Not NestJS:**

- NestJS's opinionated structure and TypeScript requirement would add learning overhead
- Dependency injection and decorators are overkill for our relatively straightforward API
- More complex setup and configuration compared to Express
- Our team is more comfortable with JavaScript than TypeScript

## Consequences

- **Fast Development**: Minimal boilerplate allows rapid prototyping and iteration
- **Proven Stability**: Express is battle-tested with mature, well-maintained middleware
- **Team Productivity**: Familiar API reduces learning curve for all team members
- **Flexible Architecture**: Freedom to organize code according to our
needs (MVC-style layered architecture)
- **Rich Middleware Ecosystem**: Pre-built solutions for authentication,
validation, file uploads, rate limiting, etc.

## Date

11/16/2025

## Participants

all team members
