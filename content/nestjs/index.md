---
title: NestJS
aliases: [nest, nest.js]
tags: [type/moc, tech/typescript]
area: nestjs
status: evergreen
related:
  - "[[index]]"
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/lifecycle-hooks]]"
  - "[[nestjs/recipes/index]]"
  - "[[nestjs/releases/index]]"
source:
  - https://docs.nestjs.com
---

Map of content for NestJS. Links marked planned are pending topics. They will get filled in over time.

## Fundamentals

What you need to master before any advanced pattern.

- [[nestjs/fundamentals/modules|Modules: feature, shared, core (planned)]]
- [[nestjs/fundamentals/di-container|DI container: providers, scopes, custom providers (planned)]]
- [[nestjs/fundamentals/lifecycle-hooks|Application lifecycle hooks: OnModuleInit, OnApplicationBootstrap, shutdown]]
- [[nestjs/fundamentals/request-lifecycle|Request lifecycle]]: [[nestjs/fundamentals/middleware|middleware]], [[nestjs/fundamentals/guards|guards]], [[nestjs/fundamentals/interceptors|interceptors]], [[nestjs/fundamentals/pipes|pipes]], [[nestjs/fundamentals/exception-filters|filters]]
- [[nestjs/fundamentals/global-providers|Global pipes, guards, interceptors, and filters via DI]]

## Recipes

Task-oriented how-tos. See [[nestjs/recipes/index|all recipes]].

- [[nestjs/recipes/file-uploads|File uploads with Multer]]
- [[nestjs/recipes/monorepo|NestJS CLI monorepos]]
- [[nestjs/recipes/rate-limiting|Rate limiting with @nestjs/throttler]]
- [[nestjs/recipes/serialization|Response serialization with class-transformer]]
- [[nestjs/recipes/swc-setup|SWC builder for NestJS]]
- [[nestjs/recipes/trace-id|Request trace ID propagation]]
- [[nestjs/recipes/validation|Request validation with class-validator]]

## Patterns

Architecture patterns that NestJS enables but does not enforce.

- [[nestjs/patterns/cqrs|CQRS: commands, queries, events (planned)]]
- [[nestjs/patterns/repository-pattern|Repository pattern: when yes, when no (planned)]]
- [[nestjs/patterns/domain-events|Domain events: EventEmitter2 vs CQRS events (planned)]]
- [[nestjs/patterns/error-handling|Error handling: filters and exception hierarchy (planned)]]

## Data

- [[nestjs/data/prisma|Prisma: setup, transactions, soft delete (planned)]]
- [[nestjs/data/typeorm/index|TypeORM]]: integration, error handling, relations
- [[nestjs/data/caching|Caching with @nestjs/cache-manager]]

## Auth

- [[nestjs/auth/jwt-strategy|JWT strategy with Passport]]
- [[nestjs/auth/guards-vs-middleware|Guards vs Middleware: when to use each (planned)]]
- [[nestjs/auth/rbac-cbac|RBAC and CBAC (planned)]]

## Testing

- [[nestjs/testing/unit-tests|Unit tests with Test.createTestingModule (planned)]]
- [[nestjs/testing/e2e|E2E with Supertest + Testcontainers (planned)]]
- [[nestjs/testing/mocks-strategy|Mocking strategy (planned)]]

## Observability

- [[nestjs/observability/logging-pino|Structured logging with Pino (planned)]]
- [[nestjs/observability/opentelemetry|OpenTelemetry: traces and metrics (planned)]]
- [[nestjs/observability/health-checks|Health checks with Terminus (planned)]]

## Deployment

- [[nestjs/deployment/docker|Docker: multistage builds (planned)]]
- [[nestjs/deployment/graceful-shutdown|Graceful shutdown (planned)]]
- [[nestjs/deployment/config-validation|Config validation with Zod (planned)]]

## Releases

- [[nestjs/releases/v11|NestJS 11: what's new and what broke]]
- [[nestjs/releases/v10|NestJS 10: what's new and what broke]]

## Gotchas

Problems I already solved and do not want to google again.

- [[nestjs/gotchas/circular-deps|Circular dependencies: forwardRef and how to avoid it (planned)]]
- [[nestjs/gotchas/scope-request-pitfalls|Request-scoped providers: the hidden cost (planned)]]
- [[nestjs/gotchas/async-providers|Async providers: useFactory with dependencies (planned)]]
