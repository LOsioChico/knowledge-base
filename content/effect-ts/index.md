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
  - "[[effect-ts/composition]]"
  - "[[effect-ts/retry-and-schedule]]"
  - "[[effect-ts/scoped-resources]]"
  - "[[effect-ts/fault-tolerant-ingestion]]"
  - "[[effect-ts/ecosystem-map]]"
source:
  - https://effect.website/docs/getting-started/the-effect-type/
  - https://github.com/Effect-TS/effect
---

> Effect is a TypeScript library for building robust applications with [[effect-ts/typed-errors|typed errors]], dependency injection, and structured concurrency (child fibers cancelled with their parent scope). Programs are values (`Effect<A, E, R>`) that a runtime executes; everything you do with them stays type-safe.

## TL;DR

- The core type is [`Effect<Success, Error, Requirements>`](https://effect.website/docs/getting-started/the-effect-type/#type-parameters), abbreviated `A`, `E`, `R`. Errors and dependencies are tracked in the type, not lost in `try/catch` and DI containers.
- Effect values are **lazy descriptions**, not running code. A runtime ([`Effect.runPromise` / `Effect.runSync` / `Effect.runFork`](https://effect.website/docs/getting-started/running-effects/)) executes them when you ask.
- Replaces (and absorbs) [`fp-ts`](https://github.com/gcanti/fp-ts): per its README, fp-ts is "officially merging with the Effect-TS ecosystem" and "Effect-TS can be regarded as the successor to fp-ts v2".
- Single npm package for the core (`effect`); the rest of the ecosystem ships under `@effect/*` (platform, cli, sql, ai, workflow, rpc, cluster, opentelemetry, vitest, …).
- Latest stable: [`effect@3.21.2`](https://registry.npmjs.org/effect/latest) (verified 2026-05-08).

## When to use

- **Use Effect** for: backend services with non-trivial error taxonomies, data pipelines (typed streams with backpressure: producers slow down when consumers lag), CLI tools (`@effect/cli`), durable workflows (`@effect/workflow`), schema-first apps (built-in `Schema` module), large-language-model (LLM) agents (`@effect/ai`).
- **Don't use Effect** for: tiny scripts where the runtime overhead and learning curve outweigh the wins; teams unwilling to learn generator syntax (`Effect.gen(function* () { ... })`) and `pipe`-based [[effect-ts/composition|composition]].
- **Adoption signal**: for the week of 2026-05-02 to 2026-05-08, the npm registry's last-week download API reports `effect` at 13,403,437 ([api.npmjs.org/downloads/point/last-week/effect](https://api.npmjs.org/downloads/point/last-week/effect)), higher than `@nestjs/core` at 9,550,875 ([same API](https://api.npmjs.org/downloads/point/last-week/@nestjs%2Fcore)). Library momentum is strong; specific paid-job demand for "Effect-TS" is a separate question and changes month to month, so check a fresh job-board search before drawing conclusions.

## Mental model

| Concept           | Shape                                                                                              | Reader hook                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Effect<A, E, R>` | Value describing a computation that, when run, either yields `A`, fails with `E`, or asks for `R`. | A typed `Promise` that also tracks errors and dependencies.               |
| Runtime           | The thing that _executes_ an `Effect`.                                                             | Like calling a thunk: nothing happens until `Effect.runPromise(program)`. |
| Layers (`R`)      | Typed dependency graph.                                                                            | DI container, but the compiler tells you when a dependency is missing.    |
| `Effect.gen`      | Generator-based domain-specific language (DSL): `yield*` an effect to "await" it.                  | `async/await` for `Effect`.                                               |

See [[effect-ts/what-is-effect|What is Effect]] for the longer version.

## Start here

If you're new to Effect, read in this order:

1. [[effect-ts/quickstart|Quickstart]]: install, write, and run a tiny effect.
2. [[effect-ts/what-is-effect|What is Effect]]: the `Effect<A, E, R>` mental model and why laziness matters.
3. [[effect-ts/composition|Composition]]: when to reach for `pipe`, `Effect.gen`, or `Effect.fn`.
4. [[effect-ts/typed-errors|Typed errors]]: the `E` channel in practice (`Effect.try`, `catchTag`).
5. [[effect-ts/layers-and-di|Layers and dependency injection]]: the `R` channel in practice.
6. [[effect-ts/retry-and-schedule|Retry and Schedule]]: bounded retries, backoff, jitter, fallback.
7. [[effect-ts/scoped-resources|Scoped resources]]: `acquireRelease` / `addFinalizer` / `Scope`; cleanup that runs on success, failure, and interruption.
8. [[effect-ts/fault-tolerant-ingestion|Fault-tolerant ingestion pipeline]]: capstone recipe composing every primitive above.

After that, [[effect-ts/ecosystem-map|Ecosystem map]] is a lookup reference for `@effect/*` packages.

## Pending notes

- Schema basics (`Schema.Struct`, encoders/decoders, OpenAPI hookup).
- Streams (`Effect.Stream`) for backpressured data flow.
- Concurrency primitives (fibers, queues, semaphores, structured cancellation).
- `Ref` for shared mutable state across fibers.
- Outbound request-rate cap recipe (`Effect.sleep` + `Schedule` for spacing requests, beyond `forEach` concurrency caps).
- Logging and tracing (`Effect.log`, `Effect.withLogSpan`, `@effect/opentelemetry`).
- Durability boundary recipe: Effect is in-process. Crash recovery requires external durable infrastructure (queue with at-least-once redelivery + idempotent handlers, or a workflow engine). Document the boundary so readers don't assume `Effect.retry` survives reboots.
- `@effect/workflow` for durable execution: Temporal-style checkpointing so workflows resume after a worker dies. Verify API surface against the package's README before drafting.
- `@effect/cluster` for distributed coordination: sharded actor-style entities across machines. Verify scope and stability before drafting (early-stage package).
- Cron and scheduled work: in-process `Effect.repeat` vs external schedulers (k8s CronJob, EventBridge, Temporal cron) triggering fresh Effect processes. Cover the "what survives a reboot" tradeoff explicitly.

## See also

- [[effect-ts/quickstart|Quickstart]]: install, write, and run your first Effect in ~10 minutes.
- [[effect-ts/what-is-effect|What is Effect]]: the type, the runtime, and why "lazy descriptions" matter.
- [[effect-ts/composition|Composition: pipe, gen, and fn]]: the three idioms for chaining effects together; when to reach for each.
- [[effect-ts/typed-errors|Typed errors]]: errors in the type signature, `Effect.try`, `catchTag`.
- [[effect-ts/layers-and-di|Layers and dependency injection]]: the `R` channel in practice; `Context.Tag`, `Effect.Service`, `Layer.provide`.
- [[effect-ts/retry-and-schedule|Retry and Schedule]]: bounded retries, exponential backoff with jitter, fallback after exhaustion.
- [[effect-ts/scoped-resources|Scoped resources]]: `acquireRelease`, `acquireUseRelease`, `addFinalizer`, `ensuring`; the four primitives for cleanup that runs on success, failure, and interruption.
- [[effect-ts/fault-tolerant-ingestion|Fault-tolerant ingestion pipeline]]: end-to-end recipe weaving `tryPromise`, `Schema`, `timeout`, `retry`, and `forEach` into one typed pipeline.
- [[effect-ts/ecosystem-map|Ecosystem map]]: every `@effect/*` package, what it does, when to install it.
- [Effect documentation](https://effect.website/docs/getting-started/introduction/) (official).
- [Effect-TS/effect on GitHub](https://github.com/Effect-TS/effect).
