---
title: Ecosystem map
aliases: [effect packages, effect ecosystem, which effect package, effect monorepo]
tags: [type/reference, tech/typescript, tech/effect-ts]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[effect-ts/layers-and-di]]"
  - "[[effect-ts/composition]]"
  - "[[effect-ts/quickstart]]"
  - "[[effect-ts/fault-tolerant-ingestion]]"
source:
  - https://github.com/Effect-TS/effect/tree/main/packages
  - https://effect.website/docs/ai/introduction/
  - https://github.com/Effect-TS/effect/blob/main/packages/cluster/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/workflow/README.md
  - https://github.com/Effect-TS/effect/blob/main/packages/rpc/README.md
  - https://github.com/Effect-TS/effect/blob/main/packages/vitest/README.md
  - https://github.com/Effect-TS/effect/blob/main/packages/typeclass/README.md
  - https://github.com/Effect-TS/effect/blob/main/packages/experimental/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/platform/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/platform-node/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/cli/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/sql/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/ai/ai/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/opentelemetry/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/printer/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/printer-ansi/package.json
  - https://github.com/Effect-TS/effect/blob/main/packages/ai/amazon-bedrock/package.json
---

> A reader's map of every package that ships from the [`Effect-TS/effect` monorepo](https://github.com/Effect-TS/effect/tree/main/packages). The core ships as `effect`; everything else lives under `@effect/*`. Use this to decide what to install before you write a line of code.

## How the packages are laid out

The core type, runtime, `Schema`, `Layer`, `Stream`, `Cause`, `Context`, `Fiber`, `Scope` and friends all ship in the single `effect` npm package ([packages/effect](https://github.com/Effect-TS/effect/tree/main/packages/effect)). Every other published package starts with `@effect/` and adds an integration: a runtime (Node/Bun/browser), a domain (HTTP, SQL, AI, CLI), a tooling layer (testing, telemetry), or experimental modules under active design.

The `@effect/sql` and `@effect/ai` lines are the only ones that fan out into per-driver / per-provider sub-packages. Everything else is a single package.

## Core packages

| Package            | What it is                                                                                                                                                                                                                                    | Reach for it when                                                                                                                        | Skip it when                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `effect`           | The core. `Effect<A, E, R>`, runners, `Schema`, `Layer`, `Stream`, `Context`, `Fiber`, `Scope`, `Schedule`, all combinators ([packages/effect](https://github.com/Effect-TS/effect/tree/main/packages/effect)).                               | Always. This is the only package you need for "use Effect at all".                                                                       | Never.                                                                            |
| `@effect/platform` | "Unified interfaces for common platform-specific services" ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/platform/package.json)): `HttpApi`, `HttpClient`, `FileSystem`, `Terminal`, `Worker`, `KeyValueStore`, etc. | You want to write platform-agnostic code that runs on Node, Bun, or the browser. Especially: HTTP servers/clients, file system, workers. | You're targeting only one runtime and prefer that runtime's native APIs directly. |

`@effect/platform` is interface-only. To actually run anything you also install one runtime adapter:

| Adapter                        | Runtime                     | Description ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/platform-node/package.json)) |
| ------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@effect/platform-node`        | Node.js                     | "Platform specific implementations for the Node.js runtime"                                                     |
| `@effect/platform-bun`         | Bun                         | "Platform specific implementations for the Bun runtime"                                                         |
| `@effect/platform-browser`     | Browser                     | "Platform specific implementations for the browser"                                                             |
| `@effect/platform-node-shared` | Node + Bun shared internals | Internals shared between the Node and Bun adapters; you don't install this directly.                            |

## Domain packages

| Package            | What it is                                                                                                                                                                                                                                                                                                                                                  | Reach for it when                                                                                                                  | Skip it when                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `@effect/cli`      | "A library for building command-line interfaces with Effect" ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/cli/package.json)): typed args, subcommands, prompts, help generation.                                                                                                                                                  | You're building a CLI in TypeScript and want typed arg parsing without `commander`/`yargs` boilerplate.                            | One-off scripts where you'd reach for `process.argv.slice(2)` anyway.                                                                       |
| `@effect/sql`      | "A SQL toolkit for Effect" ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/sql/package.json)): tagged-template SQL, connection pools, migrations, transactions, schema-typed rows.                                                                                                                                                   | You want type-safe SQL with `Layer`-managed connections and rollbacks tied to fiber lifetime.                                      | You're already heavily invested in TypeORM/Prisma and not ready to migrate; see the per-driver adapters below before deciding.              |
| `@effect/ai`       | "Effect modules for working with AI apis" ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/ai/ai/package.json)): "high-level, unified interface for modeling LLM interactions, independent of any specific provider" ([introduction](https://effect.website/docs/ai/introduction/)). Generation, embeddings, tool calling, streaming. | Building LLM agents/pipelines and you want provider-swappable code with retries, rate limits, timeouts as `Effect` operators.      | Single-call OpenAI usage where the official SDK is enough. Provider-specific features not yet abstracted may force you back to the raw SDK. |
| `@effect/workflow` | "Durable workflows for Effect" ([README](https://github.com/Effect-TS/effect/blob/main/packages/workflow/README.md)): replayable, resumable workflows backed by `@effect/cluster` + `@effect/sql` for storage.                                                                                                                                              | Long-running multi-step processes that must survive restarts (order processing, billing pipelines, signup flows with email steps). | Short-lived in-memory work; sub-second tasks; anything where a Temporal-style engine is overkill.                                           |
| `@effect/rpc`      | Type-safe RPC. Define request/response with `Schema`, get a typed client and server out of one definition ([README](https://github.com/Effect-TS/effect/blob/main/packages/rpc/README.md)).                                                                                                                                                                 | Internal service-to-service calls in a TypeScript-only stack where you want one schema for both ends.                              | You need cross-language interop (use gRPC, OpenAPI/`HttpApi` from `@effect/platform`, or REST instead).                                     |
| `@effect/cluster`  | "Unified interfaces for common cluster-specific services" ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/cluster/package.json)): entities, sharding, `Runner` model, K8s integration ([source listing](https://github.com/Effect-TS/effect/tree/main/packages/cluster/src)). The substrate `@effect/workflow` runs on.              | Distributed actor-style work: sharded entities, message routing across runners, durable in-memory state.                           | Single-node apps; this is heavy machinery for the small case.                                                                               |

## Tooling packages

| Package                                    | What it is                                                                                                                                                                                                                                                                                                                  | Reach for it when                                                                                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@effect/opentelemetry`                    | "OpenTelemetry integration for Effect" ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/opentelemetry/package.json)). Wires Effect's built-in tracing/metrics into the OpenTelemetry SDK so spans created via `Effect.withSpan` (and `Effect.fn`) export to your collector.                           | You want to actually export traces created by `Effect.withSpan` / `Effect.fn` to Jaeger, Honeycomb, Datadog, etc.                                                                       |
| `@effect/vitest`                           | "A set of helpers for testing Effects with vitest" ([README](https://github.com/Effect-TS/effect/blob/main/packages/vitest/README.md)): an enhanced `it` that takes Effect-returning test bodies, runs them with a real runtime, and reports failures with Cause traces.                                                    | Writing tests for Effect code. The plain `vitest`'s `it(name, async () => {...})` works too via `Effect.runPromise`, but the helpers handle layers and provide better assertion shapes. |
| `@effect/printer` / `@effect/printer-ansi` | "An easy to use, extensible pretty-printer for rendering documents" / "...for the terminal" ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/printer/package.json), [`-ansi`](https://github.com/Effect-TS/effect/blob/main/packages/printer-ansi/package.json)). A Wadler-style pretty-printer port. | Rendering structured output (configs, ASTs, trees) to a width-aware string. Niche, but invaluable inside CLI tools.                                                                     |
| `@effect/typeclass`                        | "A collection of reusable typeclasses for the Effect ecosystem" ([README](https://github.com/Effect-TS/effect/blob/main/packages/typeclass/README.md)): `Bounded`, `Order`, `Semigroup`, `Monoid`, `Functor`, etc. Successors to fp-ts's typeclass hierarchy.                                                               | You want category-theory-style abstractions (combining values via `Semigroup`, defining custom orderings) without writing them yourself. Most app code never needs this.                |

## Experimental

`@effect/experimental` is the staging area for modules under active design. Its package.json description: "Experimental modules for the Effect ecosystem" ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/experimental/package.json)). API stability is explicitly not guaranteed. As of 2026-05-10 the [`packages/experimental/src` listing](https://github.com/Effect-TS/effect/tree/main/packages/experimental/src) includes `DevTools`, `EventLog` (and `EventLogServer`, `EventLogEncryption`, `EventLogRemote`), `Machine`, `PersistedCache`, `PersistedQueue`, `Persistence`, `RateLimiter`, `Reactivity`, `RequestResolver`, `Sse`, `VariantSchema`.

Reach for it when you want a feature that exists nowhere else in the ecosystem and you accept that the API may change. Skip it for production code unless you're willing to pin a version and re-verify on each upgrade.

## SQL adapters

`@effect/sql` is the toolkit; you also install one driver adapter for the database you're using. Description column quoted from each adapter's package.json:

| Driver                            | Database / runtime                   | Description                                 |
| --------------------------------- | ------------------------------------ | ------------------------------------------- |
| `@effect/sql-pg`                  | PostgreSQL                           | "A PostgreSQL toolkit for Effect"           |
| `@effect/sql-mysql2`              | MySQL via `mysql2`                   | "A MySQL toolkit for Effect"                |
| `@effect/sql-mssql`               | Microsoft SQL Server                 | "A Microsoft SQL Server toolkit for Effect" |
| `@effect/sql-clickhouse`          | ClickHouse                           | "A Clickhouse toolkit for Effect"           |
| `@effect/sql-libsql`              | libSQL (Turso)                       | "A libSQL toolkit for Effect"               |
| `@effect/sql-d1`                  | Cloudflare D1                        | "A Cloudflare D1 integration for Effect"    |
| `@effect/sql-sqlite-node`         | SQLite on Node                       | "A SQLite toolkit for Effect"               |
| `@effect/sql-sqlite-bun`          | SQLite on Bun                        | "A SQLite toolkit for Effect"               |
| `@effect/sql-sqlite-do`           | SQLite on Cloudflare Durable Objects | "A SQLite toolkit for Effect"               |
| `@effect/sql-sqlite-react-native` | SQLite on React Native               | "A SQLite toolkit for Effect"               |
| `@effect/sql-sqlite-wasm`         | SQLite via Wasm                      | "A SQLite toolkit for Effect"               |
| `@effect/sql-drizzle`             | Drizzle ORM                          | "Drizzle integration for @effect/sql"       |
| `@effect/sql-kysely`              | Kysely query builder                 | "Kysely integration for @effect/sql"        |

The `-drizzle` and `-kysely` adapters wrap an existing query builder; the rest are direct database drivers.

## AI providers

`@effect/ai` defines the provider-agnostic interface; one of these provides the implementation. Versions verified 2026-05-10:

| Provider package            | Backs                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@effect/ai-openai`         | OpenAI / Azure OpenAI                                                                                                                                            |
| `@effect/ai-anthropic`      | Anthropic Claude                                                                                                                                                 |
| `@effect/ai-amazon-bedrock` | "Effect modules for working with Amazon Bedrock AI apis" ([package.json](https://github.com/Effect-TS/effect/blob/main/packages/ai/amazon-bedrock/package.json)) |
| `@effect/ai-google`         | Google Generative AI                                                                                                                                             |
| `@effect/ai-openrouter`     | OpenRouter (multi-provider gateway)                                                                                                                              |

Per the [`packages/ai` listing](https://github.com/Effect-TS/effect/tree/main/packages/ai), these are all the official provider sub-packages. The `@effect/ai` parent ships the abstract interface; you install at least one provider package on top.

## Reading the dependency graph

```
                   effect (core)
                      │
       ┌──────────────┼─────────────────────┐
       ▼              ▼                     ▼
  @effect/platform  @effect/cli       @effect/typeclass
       │
       ├── platform-node | platform-bun | platform-browser  (pick one runtime)
       │
       ▼
  apps wire layers from any of:
    @effect/sql + one driver       (database)
    @effect/ai  + one provider     (LLM)
    @effect/rpc                    (typed RPC over HTTP)
    @effect/cluster                (distributed entities, sharding)
       │
       ▼
  @effect/workflow                 (durable workflows; depends on cluster + sql)
       │
       ▼
  @effect/opentelemetry            (export traces/metrics anywhere)
  @effect/vitest                   (test the whole thing)
```

The arrows are "typically composed with", not strict npm dependencies. Most packages declare `effect` and `@effect/platform` as peer dependencies, but several add more (`@effect/cluster` peers on `@effect/rpc`, `@effect/sql`, and `@effect/workflow`; `@effect/ai` peers on `@effect/rpc` and `@effect/experimental`; `@effect/opentelemetry` peers on the OpenTelemetry SDK packages). [[effect-ts/composition|Composition]] is a separate axis from packaging: the `@effect/workflow` README's example explicitly composes `ClusterWorkflowEngine` from `@effect/cluster` with `PgClient.layer` from `@effect/sql-pg` to get persistence.

## See also

- [[effect-ts/index|Effect-TS]] (area MOC).
- [[effect-ts/what-is-effect|What is Effect]]: the core type and runtime, before any of these packages enter the picture.
- [[effect-ts/composition|Composition: pipe, gen, and fn]]: the three idioms for chaining effects together, regardless of which package you're using.
- [[effect-ts/layers-and-di|Layers and dependency injection]]: how every package above is wired into your `R` channel.
- [Effect-TS/effect on GitHub](https://github.com/Effect-TS/effect): the source repository.
- [Effect docs](https://effect.website/docs/getting-started/introduction/): the official site, organized by capability rather than by package.
