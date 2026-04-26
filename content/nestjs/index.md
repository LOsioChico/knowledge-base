---
title: NestJS
aliases: [nest, nest.js]
tags: [type/moc, tech/typescript]
area: nestjs
status: evergreen
related:
  - "[[index]]"
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/recipes/index]]"
source:
  - https://docs.nestjs.com
---

Map of content for NestJS. Broken links are pending topics. They will get filled in over time.

## Fundamentals

What you need to master before any advanced pattern.

- [[nestjs/fundamentals/modules|Modules: feature, shared, core]]
- [[nestjs/fundamentals/di-container|DI container: providers, scopes, custom providers]]
- [[nestjs/fundamentals/lifecycle|Lifecycle hooks: OnModuleInit, OnApplicationBootstrap]]
- [[nestjs/fundamentals/request-lifecycle|Request lifecycle: middleware, guards, interceptors, pipes, filters]]

## Recipes

Task-oriented how-tos. See [[nestjs/recipes/index|all recipes]].

- [[nestjs/recipes/file-uploads|File uploads with Multer]]

## Patterns

Architecture patterns that NestJS enables but does not enforce.

- [[nestjs/patterns/cqrs|CQRS: commands, queries, events]]
- [[nestjs/patterns/repository-pattern|Repository pattern: when yes, when no]]
- [[nestjs/patterns/domain-events|Domain events: EventEmitter2 vs CQRS events]]
- [[nestjs/patterns/error-handling|Error handling: filters and exception hierarchy]]

## Data

- [[nestjs/data/prisma|Prisma: setup, transactions, soft delete]]
- [[nestjs/data/typeorm|TypeORM: relations and query builder]]
- [[nestjs/data/caching|Caching: CacheModule + Redis]]

## Auth

- [[nestjs/auth/jwt-strategy|JWT strategy with Passport]]
- [[nestjs/auth/guards-vs-middleware|Guards vs Middleware: when to use each]]
- [[nestjs/auth/rbac-cbac|RBAC and CBAC]]

## Testing

- [[nestjs/testing/unit-tests|Unit tests with Test.createTestingModule]]
- [[nestjs/testing/e2e|E2E with Supertest + Testcontainers]]
- [[nestjs/testing/mocks-strategy|Mocking strategy]]

## Observability

- [[nestjs/observability/logging-pino|Structured logging with Pino]]
- [[nestjs/observability/opentelemetry|OpenTelemetry: traces and metrics]]
- [[nestjs/observability/health-checks|Health checks with Terminus]]

## Deployment

- [[nestjs/deployment/docker|Docker: multistage builds]]
- [[nestjs/deployment/graceful-shutdown|Graceful shutdown]]
- [[nestjs/deployment/config-validation|Config validation with Zod]]

## Gotchas

Problems I already solved and do not want to google again.

- [[nestjs/gotchas/circular-deps|Circular dependencies: forwardRef and how to avoid it]]
- [[nestjs/gotchas/scope-request-pitfalls|Request-scoped providers: the hidden cost]]
- [[nestjs/gotchas/async-providers|Async providers: useFactory with dependencies]]
