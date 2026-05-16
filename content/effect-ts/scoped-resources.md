---
title: Scoped resources
aliases:
  [
    effect acquire release,
    effect finalizer,
    effect scope,
    effect resource cleanup,
    effect addFinalizer,
    effect ensuring,
  ]
tags: [type/concept, tech/typescript, tech/effect-ts, gotchas]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[effect-ts/composition]]"
  - "[[effect-ts/typed-errors]]"
  - "[[effect-ts/layers-and-di]]"
  - "[[effect-ts/fault-tolerant-ingestion]]"
source:
  - https://effect.website/docs/resource-management/introduction/
  - https://effect.website/docs/resource-management/scope/
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts
---

> A scoped resource is one whose cleanup is wired to the lifetime of an `Effect`, so the runtime guarantees release on success, failure, **and interruption**. The four primitives `acquireRelease`, `acquireUseRelease`, `addFinalizer`, and `ensuring` cover the entire space; pick by who owns the lifetime and whether you need access to the exit value.

## Why this primitive exists

`try/finally` runs the finally block on synchronous throws. It does not run when an `await` is abandoned by an upstream cancellation, or when a parent fiber (the lightweight task that's running the effect, see [[effect-ts/what-is-effect|what is Effect]]) is interrupted, or when a request is dropped because the client disconnected. The whole point of structured concurrency (see [[effect-ts/what-is-effect|what is Effect]]) is that interruption propagates down the call tree; the matching guarantee is that resource release also runs on the way down. Effect's resource APIs are the contract: register a finalizer, the runtime promises to run it.

Per [Effect.acquireRelease's source JSDoc](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5371-L5398): "Both `acquire` and `release` run uninterruptibly, meaning they cannot be interrupted while they are executing." Per [the Scope docs](https://effect.website/docs/resource-management/scope/): finalizers run "even in the event of an unexpected interruption or error" and "in reverse order of addition."

## The four primitives

| API                        | Lifetime owner        | Use when                                                                                                                                                                                                         |
| -------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Effect.acquireUseRelease` | The function itself   | One-shot: acquire, do something with it, release. The whole transaction lives inside one expression. No `Scope` leaks into `R`.                                                                                  |
| `Effect.acquireRelease`    | The enclosing `Scope` | The resource needs to outlive a single `use` block: shared across many operations, or wrapped in `Layer.scoped` for DI (see [[effect-ts/layers-and-di                                                            | Layers and DI]]). Adds `Scope` to the `R` channel; discharge with `Effect.scoped`. |
| `Effect.addFinalizer`      | The enclosing `Scope` | Inside an `Effect.gen` block when you want to register cleanup _next to_ the code that needs it, not bundled with acquisition. Same `Scope` requirement as `acquireRelease`.                                     |
| `Effect.ensuring`          | The wrapped effect    | "Run this cleanup no matter how the effect ends." Lower-level; no `Scope` involved. Use for cleanup that doesn't need access to a value (`acquireRelease` is the right call when there _is_ a resource to pass). |

The first three integrate with `Scope`; `ensuring` is a bare wrapper. Source: [Effect.ts#L5453-L5461](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5453-L5461) (`acquireRelease`), [#L5550-L5560](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5550-L5560) (`acquireUseRelease`), [#L5681-L5683](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5681-L5683) (`addFinalizer`), [#L5755-L5758](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5755-L5758) (`ensuring`).

## `acquireUseRelease`: the simplest case

When the resource's lifetime equals one block of work, this is the right primitive. Acquire, run the body, release; the runtime guarantees release runs even if the body fails or is interrupted ([Effect.ts#L5499-L5545](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5499-L5545)).

```typescript
import { Console, Effect } from "effect";

interface BrowserPage {
  readonly url: string;
  readonly close: () => Promise<void>;
}

const openPage = (url: string): Promise<BrowserPage> =>
  Promise.resolve({
    url,
    close: () =>
      new Promise((resolve) => {
        console.log(`closed ${url}`);
        resolve();
      }),
  });

const acquire = Effect.tryPromise({
  try: () => openPage("https://example.com"),
  catch: (cause) => new Error(`open failed: ${String(cause)}`),
});

const use = (page: BrowserPage) => Console.log(`scraping ${page.url}`);

const release = (page: BrowserPage) => Effect.promise(() => page.close());

//      ┌─── Effect<void, Error, never>
//      ▼
const program = Effect.acquireUseRelease(acquire, use, release);

Effect.runPromise(program);
// Output:
// scraping https://example.com
// closed https://example.com
```

Note `R` is `never`: the scope is internal to the call. If `use` fails, throws, or is interrupted by a surrounding `timeout`/`retry`, `release` still runs.

## `acquireRelease` + `Scope`: resources that outlive one block

When the same resource is reused across many operations (a connection pool, a logged-in browser context), the lifetime is the **enclosing scope**, not one expression. `Effect.acquireRelease` registers the resource into whatever scope is in scope (no pun intended) and adds `Scope` to the `R` channel:

```typescript
import { Console, Effect } from "effect";

interface DbPool {
  readonly query: (sql: string) => Promise<unknown>;
  readonly end: () => Promise<void>;
}

const connect = Effect.tryPromise({
  try: () =>
    Promise.resolve<DbPool>({
      query: (sql) => Promise.resolve({ sql }),
      end: () => {
        console.log("pool closed");
        return Promise.resolve();
      },
    }),
  catch: (cause) => new Error(`connect failed: ${String(cause)}`),
});

const close = (pool: DbPool) => Effect.promise(() => pool.end());

//      ┌─── Effect<DbPool, Error, Scope>
//      ▼
const pool = Effect.acquireRelease(connect, close);
```

Notice `Scope` in `R`. The compiler now refuses to run the effect until that scope is provided. Two ways to provide it:

1. **`Effect.scoped(program)`** discharges the scope at this exact boundary: open a fresh scope, run, close it on exit. Use when the resource lifetime equals "this program".
2. **`Layer.scoped(Tag, ...)`** lifts the resource into a [[effect-ts/layers-and-di|service layer]]; the lifetime equals the layer's. Use when many call sites share the same resource.

```typescript
import { Effect } from "effect";

// `pool` is the Effect<DbPool, Error, Scope> from the previous snippet.

//      ┌─── Effect<unknown, Error, Scope>
//      ▼
const work = Effect.gen(function* () {
  const db = yield* pool;
  return yield* Effect.promise(() => db.query("SELECT 1"));
});

//      ┌─── Effect<unknown, Error, never>
//      ▼
const main = Effect.scoped(work);

Effect.runPromise(main);
// Output:
// pool closed
```

`Scope` is gone from `R` after `Effect.scoped`. The pool is acquired, the query runs, the pool closes : even if `query` throws or `main` is interrupted by a parent fiber's timeout.

## `addFinalizer`: register cleanup next to the work

Inside an `Effect.gen` block, sometimes the natural place to declare cleanup is right next to the code that allocated it, not bundled at the top in an `acquireRelease`. `Effect.addFinalizer` registers a finalizer against the enclosing scope and gives it the `Exit` value so it can branch on success/failure/interruption ([Effect.ts#L5562-L5605](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5562-L5605)):

```typescript
import { Console, Effect, Exit } from "effect";

//      ┌─── Effect<string, never, Scope>
//      ▼
const program = Effect.gen(function* () {
  yield* Effect.addFinalizer((exit) =>
    Exit.isSuccess(exit) ? Console.log("committed") : Console.log(`rolled back: ${exit._tag}`),
  );
  return "result";
});

//      ┌─── Effect<string, never, never>
//      ▼
const main = Effect.scoped(program);

Effect.runPromise(main).then(console.log);
// Output:
// committed
// result
```

Same `Scope` requirement, same `Effect.scoped` discharge. `addFinalizer` is the right call when the resource isn't a single `acquire`/`release` pair (e.g., a transaction whose commit-or-rollback decision depends on the exit value).

## `ensuring`: cleanup without a scope

The lowest-level option. `Effect.ensuring(cleanup)` runs `cleanup` after the wrapped effect, regardless of outcome; no `Scope` enters `R` ([Effect.ts#L5697-L5758](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5697-L5758)):

```typescript
import { Console, Effect } from "effect";

const work = Console.log("doing work").pipe(Effect.tap(() => Effect.fail(new Error("boom"))));

//      ┌─── Effect<void, Error, never>
//      ▼
const guarded = work.pipe(Effect.ensuring(Console.log("cleanup ran")));

Effect.runPromiseExit(guarded);
// Output:
// doing work
// cleanup ran
```

Use `ensuring` when you don't have a resource value to clean up, just a side effect to run on the way out (close a tracing span, flush a log buffer). When you _do_ have a resource value, the source JSDoc is explicit: "for higher-level resource management with automatic acquisition and release, see the `acquireRelease` family" ([Effect.ts#L5700-L5703](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5700-L5703)).

## Finalizer ordering

Per [the Scope docs](https://effect.website/docs/resource-management/scope/), finalizers run in **reverse order of registration** when the scope closes. This is the last-in-first-out (LIFO) stack a reader of imperative code expects: if you opened A then B, you close B then A. Important when resources depend on each other (close the transaction before closing the connection it ran on).

```typescript
import { Console, Effect } from "effect";

const program = Effect.gen(function* () {
  yield* Effect.addFinalizer(() => Console.log("finalizer 1"));
  yield* Effect.addFinalizer(() => Console.log("finalizer 2"));
  yield* Effect.addFinalizer(() => Console.log("finalizer 3"));
});

Effect.runPromise(Effect.scoped(program));
// Output:
// finalizer 3
// finalizer 2
// finalizer 1
```

## How this composes with retry, timeout, and interrupt

This is the load-bearing reason scoped resources matter. When `Effect.timeout` fires or a parent fiber interrupts a child, the runtime walks the chain of nested `Scope`s (the runtime's lifetime containers, distinct from JavaScript's lexical scope) and runs every registered finalizer before propagating the failure. So a [[effect-ts/fault-tolerant-ingestion|fault-tolerant ingestion pipeline]] wrapping `acquireUseRelease(openPage, scrape, closePage)` in `Effect.timeout("5 seconds")` gets the page closed even when the timeout cancels the scrape mid-flight; a wrapping `Effect.retry` re-runs the whole `acquireUseRelease`, so each retry gets a fresh page and the previous one is closed before the next attempt begins.

The compiler check is "did you discharge the `Scope`?" If `R` still contains `Scope` at the runner, you forgot `Effect.scoped`. The runtime check ("did the finalizer actually run?") is the runtime's contract; you don't write it.

## Gotchas

> [!warning] `acquireRelease`'s `acquire` and `release` are uninterruptible
> Per the source JSDoc ([Effect.ts#L5392-L5393](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5392-L5393)): "Both `acquire` and `release` run uninterruptibly, meaning they cannot be interrupted while they are executing." This is the right default : interrupting half-way through opening a connection leaks file descriptors. If you specifically need an interruptible acquire (long-running TCP handshake you'd rather kill than wait out), use `Effect.acquireReleaseInterruptible` ([Effect.ts#L5476-L5484](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5476-L5484)). The release stays uninterruptible regardless.

> [!warning] Forgetting `Effect.scoped` leaks finalizers into the surrounding scope
> If `R` contains `Scope` and you provide a parent scope (e.g., from another `Effect.scoped`) instead of discharging it locally, the finalizer runs at the _parent's_ close, not yours. For one-shot use, always wrap with `Effect.scoped` at the boundary; for long-lived services, use `Layer.scoped` so the runtime owns the lifetime.

> [!info]- `ensuring` vs `onExit` vs `onError`
> All three run on completion, none of them require a `Scope`. `Effect.ensuring(c)` runs `c` regardless of outcome with no access to the result. `Effect.onExit(c)` passes the `Exit<A, E>` so `c` can branch on success vs failure ([Effect.ts#L5909](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5909)). `Effect.onError(c)` passes the `Cause<E>` and only runs on failure ([Effect.ts#L5835](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5835)). Pick by how much you need to know about why the effect ended; pick `acquireRelease` when there's a resource to release, not just a side effect to run.

> [!info]- Why `Scope` shows up in `R`
> The `R` (Requirements) channel tracks "things this effect needs from the outside world to run" : services, configs, and _the lifetime container that will run the finalizers_. Marking `Scope` as a requirement means the compiler refuses to execute an effect with un-discharged finalizers; you can't accidentally `runPromise` a program that registered cleanup nobody will run. Same mechanism as services in [[effect-ts/layers-and-di|Layers and DI]], applied to lifetimes.

## See also

- [[effect-ts/fault-tolerant-ingestion|Fault-tolerant ingestion pipeline]]: where this matters in practice : wrap each per-item fetch in `acquireUseRelease` if it owns a resource (browser page, transaction).
- [[effect-ts/layers-and-di|Layers and DI]]: `Layer.scoped` lifts an `acquireRelease` into a service whose lifetime equals the layer's.
- [[effect-ts/composition|Composition]]: `pipe`, `gen`, and `fn` all compose with scoped resources without ceremony.
- [[effect-ts/what-is-effect|What is Effect]]: the structured-concurrency model that makes the cleanup guarantee possible.
- [Resource management introduction](https://effect.website/docs/resource-management/introduction/) (official).
- [Scope](https://effect.website/docs/resource-management/scope/) (official).
