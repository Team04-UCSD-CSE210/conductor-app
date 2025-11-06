# ADR-0001: Database Selection — PostgreSQL

## Date

2025-11-05

## Status

Accepted

## Context

During early development, the Conductor-App team needed to select a database system to store and
manage user, team, and attendance data. The two main candidates were **SQLite** and **PostgreSQL**.

SQLite was initially considered for its simplicity and minimal setup requirements, making it
appealing for quick prototyping and local development. However, as the project evolved toward a
multi-user, production-scale web application, several requirements emerged:

- Concurrent read/write operations from multiple users
- Role-based access and complex relational data
- Integration with cloud services and CI pipelines
- Scalability for future analytics and reporting

These needs exceeded what SQLite could handle efficiently.

## Decision

We chose **PostgreSQL** as the primary database for both development and production environments.

PostgreSQL provides:

- Full **ACID compliance** for transactional consistency  
- Strong **schema enforcement** and support for relational data  
- Excellent **concurrency handling** for multi-user workloads  
- Smooth integration with **Node.js** libraries (e.g., `pg`, `Prisma`)  
- Compatibility with **Docker-based local setup** and **cloud-hosted PostgreSQL services** (Render, Supabase, Railway)

## Consequences

**Easier:**

- Modeling and enforcing data relationships (foreign keys, joins)
- Scaling from local development to production environments
- Maintaining data integrity under concurrent access
- Using advanced SQL features for reporting and analytics
- Integrating CI/CD workflows and automated migrations

**More difficult:**

- Slightly more setup overhead compared to SQLite
- Requires active maintenance (backups, migrations, version upgrades)
- Local environments must run a PostgreSQL container or service

Overall, PostgreSQL offers a strong foundation for current needs and future scalability, making it
the right choice for our database layer.
