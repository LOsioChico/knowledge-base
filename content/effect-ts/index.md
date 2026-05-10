---
title: Effect-TS
aliases: [effect, effect ts, effect typescript]
tags: [type/moc, tech/typescript, tech/effect-ts]
area: effect-ts
status: seed
related:
  - "[[index]]"
  - "[[effect-ts/quickstart]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[effect-ts/typed-errors]]"
  - "[[effect-ts/layers-and-di]]"
source:
  - https://effect.website/docs/getting-started/the-effect-type/
  - https://github.com/Effect-TS/effect
---

> Effect is a TypeScript library for building robust applications with [[effect-ts/typed-errors|typed errors]], dependency injection, and structured concurrency (a model where every spawned task has a well-defined parent and is cancelled with it). Programs are values (`Effect<A, E, R>`) that a runtime executes; everything you do with them stays type-safe.

## TL;DR

- The core type is [`Effect<Success, Error, Requirements>`](https://effect.website/docs/getting-started/the-effect-type/#type-parameters), abbreviated `A`, `E`, `R`. Errors and dependencies are tracked in the type, not lost in `try/catch` and DI containers.
- Effect values are **lazy descriptions**, not running code. A runtime (`Effect.runPromise` / `Effect.runSync` / `Effect.runFork`) executes them when you ask.
- Replaces (and absorbs) [`fp-ts`](https://github.com/gcanti/fp-ts): per its README, fp-ts is "officially merging with the Effect-TS ecosystem" and "Effect-TS can be regarded as the successor to fp-ts v2".
- Single npm package for the core (`effect`); the rest of the ecosystem ships under `@effect/*` (platform, cli, sql, ai, workflow, rpc, cluster, opentelemetry, vitest, …).
- Latest stable: [`effect@3.21.2`](https://registry.npmjs.org/effect/latest) (verified 2026-05-08).

## When to use

- **Use Effect** for: backend services with non-trivial error taxonomies, data pipelines (typed streams + backpressure: automatic flow control where slow consumers slow producers), CLI tools (`@effect/cli`), durable workflows (`@effect/workflow`), schema-first apps (built-in `Schema` module), large-language-model (LLM) agents (`@effect/ai`).
- **Don't use Effect** for: tiny scripts where the runtime overhead and learning curve outweigh the wins; teams unwilling to learn generator syntax (`Effect.gen(function* () { ... })`) and `pipe`-based composition.
- **Adoption signal**: as of 2026-05-08 the npm registry's last-week download API reports `effect` at 12,942,715 ([api.npmjs.org/downloads/point/last-week/effect](https://api.npmjs.org/downloads/point/last-week/effect)), higher than `@nestjs/core` at 9,032,499 ([same API](https://api.npmjs.org/downloads/point/last-week/@nestjs%2Fcore)). Library momentum is strong; specific paid-job demand for "Effect-TS" is a separate question and changes month to month, so check a fresh job-board search before drawing conclusions.

## Why Effect (the seven pillars)

The [Effect docs landing](https://effect.website/docs/) frames the value proposition as seven cross-cutting capabilities, all delivered by the same `Effect<A, E, R>` value:

| Pillar              | What it buys you                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Type Safety**     | Success, failure, and dependency types live in the signature. The compiler refuses to run an `Effect` whose `R` channel still has unsatisfied requirements.  |
| **Error Handling**  | Failures are typed values in the `E` channel; `catchTag` removes a tag from `E` and forgetting one is a compile error. See [[effect-ts/typed-errors]].       |
| **Composability**   | Effects compose with `pipe` and `Effect.gen`; the type carries through. Add a new failure mode anywhere in the chain and the union widens automatically.     |
| **Asynchronicity**  | The same `Effect` value uniformly represents sync, async, and callback-based work. The runner (`runSync` / `runPromise` / `runFork`) decides how to execute. |
| **Concurrency**     | Lightweight in-process fibers (think goroutines) with structured cancellation: a parent fiber's interruption propagates to its children deterministically.   |
| **Resource Safety** | Scoped resources (DB connections, file handles) are guaranteed released even on interruption or failure: no `try/finally` boilerplate to forget.             |
| **Observability**   | Built-in tracing, metrics, and logging hooks (`@effect/opentelemetry`); spans wrap any effect without rewriting it.                                          |

Read these as motivations, not features to memorize. The next layer down ([[effect-ts/what-is-effect|What is Effect]]) explains how a single value type delivers all seven.

## Mental model

| Concept           | Shape                                                                                              | Reader hook                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Effect<A, E, R>` | Value describing a computation that, when run, either yields `A`, fails with `E`, or asks for `R`. | A typed `Promise` that also tracks errors and dependencies.               |
| Runtime           | The thing that _executes_ an `Effect`.                                                             | Like calling a thunk: nothing happens until `Effect.runPromise(program)`. |
| Layers (`R`)      | Typed dependency graph.                                                                            | DI container, but the compiler tells you when a dependency is missing.    |
| `Effect.gen`      | Generator-based DSL (domain-specific language): `yield*` an effect to "await" it.                  | `async/await` for `Effect`.                                               |

See [[effect-ts/what-is-effect|What is Effect]] for the longer version.

## Pending notes

- Schema basics (`Schema.Struct`, encoders/decoders, OpenAPI hookup).
- Streams (`Effect.Stream`) for backpressured data flow.
- Concurrency primitives (fibers, queues, semaphores, structured cancellation).
- `@effect/platform` HTTP server vs NestJS for backend APIs.

## See also

- [[effect-ts/quickstart|Quickstart]]: install, write, and run your first Effect in ~10 minutes.
- [[effect-ts/what-is-effect|What is Effect]]: the type, the runtime, and why "lazy descriptions" matter.
- [[effect-ts/typed-errors|Typed errors]]: errors in the type signature, `Effect.try`, `catchTag`.
- [[effect-ts/layers-and-di|Layers and dependency injection]]: the `R` channel in practice; `Context.Tag`, `Effect.Service`, `Layer.provide`.
- [Effect documentation](https://effect.website/docs/getting-started/introduction/) (official).
- [Effect-TS/effect on GitHub](https://github.com/Effect-TS/effect).
