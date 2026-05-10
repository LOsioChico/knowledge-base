---
title: What is Effect
aliases: [effect type, effect mental model, effect a e r, effect channels]
tags: [type/concept, tech/typescript, tech/effect-ts]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/quickstart]]"
  - "[[effect-ts/typed-errors]]"
  - "[[effect-ts/layers-and-di]]"
  - "[[effect-ts/composition]]"
  - "[[effect-ts/ecosystem-map]]"
source:
  - https://effect.website/docs/getting-started/the-effect-type/
  - https://effect.website/docs/getting-started/running-effects/
---

> Effect's core type is `Effect<Success, Error, Requirements>`: a value that _describes_ a computation. A runtime executes it. Errors and dependencies live in the type, not in `try/catch` and DI containers.

## The type, three channels

Per the [Effect type docs](https://effect.website/docs/getting-started/the-effect-type/#type-parameters), the three parameters are:

| Channel | Name in docs | What it tracks                                                   |
| ------- | ------------ | ---------------------------------------------------------------- |
| `A`     | Success      | The value the effect yields when it succeeds.                    |
| `E`     | Error        | The expected, recoverable errors that can occur.                 |
| `R`     | Requirements | The contextual data the effect needs to run (services, configs). |

Read `Effect<User, NotFound, UserRepo>` as: "when you run this, you get a `User`, or it fails with `NotFound`, and to run it at all you must provide a `UserRepo`." The compiler enforces all three.

```typescript
import { Effect } from "effect";

declare const findUser: (id: string) => Effect.Effect<
  { name: string }, // A: success type
  { _tag: "NotFound" }, // E: error type
  never // R: no dependencies needed
>;
```

## "Lazy descriptions, not running code"

Per the same docs, `Effect` values are "lazily executed... it doesn't run immediately" and "every function in the Effect library produces a new `Effect` value" (immutable). Importing a module that defines an `Effect` runs nothing; constructing one runs nothing; chaining `pipe(Effect.map(...))` runs nothing. Only a runtime call (`Effect.runPromise` / `Effect.runSync` / `Effect.runFork`) actually executes work.

```typescript
import { Effect } from "effect";

// Building this value does NOT log anything yet.
const program = Effect.sync(() => {
  console.log("side effect");
  return 42;
});

// Now it runs.
const result = Effect.runSync(program); // logs "side effect", result === 42
```

This is the single biggest mental shift coming from `Promise`. A `Promise` starts executing the moment it's constructed; an `Effect` waits to be handed to a runtime. That's what makes effects composable, retryable, cancellable, and testable: you can transform the description before deciding to run it (or run it many times).

> [!info]- Promise vs Effect, in one paragraph
> A `Promise<T>` represents an in-flight computation that already started and either resolves to `T` or rejects with `unknown`. An `Effect<A, E, R>` represents a _recipe_ for a computation that hasn't started, will resolve to `A` or fail with the _typed_ error `E`, and needs `R` provided to execute. Same problem space, different point on the eager/lazy axis. The lazy variant is what unlocks "retry the whole thing 3 times with backoff" as a one-liner.

## The runtime: three ways to execute

Effect ships three [runners](https://effect.website/docs/getting-started/running-effects/):

| Runner                      | Returns                                    | When                                                                                                                                      |
| --------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Effect.runSync(effect)`    | `A` (the success value), throws on failure | Synchronous code paths only. Throws if the effect contains async work.                                                                    |
| `Effect.runPromise(effect)` | `Promise<A>` (rejects on failure)          | Bridge to `async/await` code (Express handlers, test bodies).                                                                             |
| `Effect.runFork(effect)`    | `Fiber<A, E>` (observable, interruptible)  | Long-running or background work where you want a handle to cancel later. The foundational runner; the other two are convenience wrappers. |

Pick the runner at the **edge of your program** (the entry point), not in the middle. Inside your program, compose effects with `pipe` and `Effect.gen`; let the entry point decide how to actually execute the result.

## Why this design

Three problems Effect solves that plain TypeScript + `Promise` does not:

### 1. Errors in the type signature

`Promise<T>` rejects with `unknown` (or `any`, depending on your tsconfig). The compiler will not tell you which `await` could throw what. `Effect<A, E, R>` puts the failure type in `E`, so:

```typescript
import { Data, Effect } from "effect";

class NetworkError extends Data.TaggedError("NetworkError")<{}> {}
class ParseError extends Data.TaggedError("ParseError")<{}> {}

declare const fetchUser: () => Effect.Effect<{ id: string }, NetworkError | ParseError>;

// The compiler knows EXACTLY what can fail. No "did I forget a catch?" doubt.
```

`Effect.catchTag` then _removes_ a tag from `E`, so after handling `NetworkError` the remaining failure type is `Effect<{ id: string }, ParseError>`. Forgetting a case becomes a compile error. See [[effect-ts/typed-errors|Typed errors]] for the full pattern.

### 2. Dependency injection in the type signature

The `R` channel carries everything the effect needs from the outside world. When you provide a service via a `Layer`, the `R` shrinks; when every dependency is satisfied, `R` is `never` and the effect is runnable. The compiler refuses to run an effect whose `R` is not `never`:

```typescript
import { Context, Data, Effect, Layer } from "effect";

class NotFound extends Data.TaggedError("NotFound")<{ readonly id: string }> {}

class UserRepo extends Context.Tag("UserRepo")<
  UserRepo,
  { readonly find: (id: string) => Effect.Effect<{ id: string; name: string }, NotFound> }
>() {}

const UserRepoLive = Layer.succeed(UserRepo, {
  find: (id) =>
    id === "u_1" ? Effect.succeed({ id, name: "Ada" }) : Effect.fail(new NotFound({ id })),
});

//        ┌─── Effect<{ id: string; name: string }, NotFound, UserRepo>
//        ▼
const program = Effect.gen(function* () {
  const repo = yield* UserRepo;
  return yield* repo.find("u_1");
});

// Effect.runSync(program) // ❌ type error: missing UserRepo

const provided = program.pipe(Effect.provide(UserRepoLive));
//      ┌─── Effect<{ id: string; name: string }, NotFound, never>
//      ▼
console.log(Effect.runSync(provided));
// Output: { id: 'u_1', name: 'Ada' }
```

No string tokens, no module-resolution magic, no "service not registered" runtime crashes. The same compiler that catches typos catches missing dependencies.

### 3. Structured concurrency and resource safety

Because effects are lazy values, the runtime can implement primitives that would be near-impossible to retrofit onto `Promise`: structured cancellation that propagates through the call tree, fibers (lightweight tasks the runtime schedules) that supervise children, scoped resources released even on interruption. These are the features Effect inherits from the ZIO design (Scala's effect system, where the same model has been load-bearing in production for years).

## Ecosystem snapshot

The core ships as the single `effect` npm package. Adjacent packages live under `@effect/*` in the [packages directory](https://github.com/Effect-TS/effect/tree/main/packages):

- `@effect/platform` (+ `-node`, `-bun`, `-browser`): HTTP server/client, file system, terminal: runtime-agnostic platform layer.
- `@effect/cli`: typed CLI args, subcommands, prompts.
- `@effect/sql` (+ adapters: `pg`, `mysql2`, `sqlite-node`, `clickhouse`, `drizzle`, `kysely`, …): typed SQL with connection pools and migrations.
- `@effect/ai`: typed wrappers around OpenAI / Anthropic with retry, streaming, tool-calling.
- `@effect/workflow`: durable, resumable workflows similar to Temporal (the durable-workflow engine), in-process.
- `@effect/rpc`, `@effect/cluster`, `@effect/opentelemetry`, `@effect/vitest`, `@effect/printer`, `@effect/typeclass`, `@effect/experimental`.

`Schema` (validators, encoders, decoders, OpenAPI schema generation for HTTP APIs) is exported from the core `effect` package itself; the standalone `@effect/schema` package is **not** in the current `packages/` directory and should be treated as legacy unless re-verified.

## Relationship to fp-ts

Per the [`fp-ts` README](https://github.com/gcanti/fp-ts), "fp-ts is officially merging with the Effect-TS ecosystem" and "Effect-TS can be regarded as the successor to fp-ts v2 and embodies what would be considered fp-ts v3." If you have an existing `fp-ts` codebase, the migration path leads here.

## See also

- [[effect-ts/quickstart|Quickstart]]: install and run your first effect.
- [[effect-ts/typed-errors|Typed errors]]: the `E` channel in practice.
- [Effect type page](https://effect.website/docs/getting-started/the-effect-type/) (official).
- [Running effects page](https://effect.website/docs/getting-started/running-effects/) (official).
