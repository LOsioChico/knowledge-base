---
title: NestJS
tags:
  - nestjs
  - backend
  - typescript
---

Map of content for NestJS. Broken links are pending topics. They will get filled in over time.

## Fundamentals

What you need to master before any advanced pattern.

- [[fundamentals/modules|Modules: feature, shared, core]]
- [[fundamentals/di-container|DI container: providers, scopes, custom providers]]
- [[fundamentals/lifecycle|Lifecycle hooks: OnModuleInit, OnApplicationBootstrap]]
- [[fundamentals/request-lifecycle|Request lifecycle: middleware, guards, interceptors, pipes, filters]]

## Patterns

Architecture patterns that NestJS enables but does not enforce.

- [[patterns/cqrs|CQRS: commands, queries, events]]
- [[patterns/repository-pattern|Repository pattern: when yes, when no]]
- [[patterns/domain-events|Domain events: EventEmitter2 vs CQRS events]]
- [[patterns/error-handling|Error handling: filters and exception hierarchy]]

## Data

- [[data/prisma|Prisma: setup, transactions, soft delete]]
- [[data/typeorm|TypeORM: relations and query builder]]
- [[data/caching|Caching: CacheModule + Redis]]

## Auth

- [[auth/jwt-strategy|JWT strategy with Passport]]
- [[auth/guards-vs-middleware|Guards vs Middleware: when to use each]]
- [[auth/rbac-cbac|RBAC and CBAC]]

## Testing

- [[testing/unit-tests|Unit tests with Test.createTestingModule]]
- [[testing/e2e|E2E with Supertest + Testcontainers]]
- [[testing/mocks-strategy|Mocking strategy]]

## Observability

- [[observability/logging-pino|Structured logging with Pino]]
- [[observability/opentelemetry|OpenTelemetry: traces and metrics]]
- [[observability/health-checks|Health checks with Terminus]]

## Deployment

- [[deployment/docker|Docker: multistage builds]]
- [[deployment/graceful-shutdown|Graceful shutdown]]
- [[deployment/config-validation|Config validation with Zod]]

## Gotchas

Problems I already solved and do not want to google again.

- [[gotchas/circular-deps|Circular dependencies: forwardRef and how to avoid it]]
- [[gotchas/scope-request-pitfalls|Request-scoped providers: the hidden cost]]
- [[gotchas/async-providers|Async providers: useFactory with dependencies]]
