---
title: Fault-tolerant ingestion pipeline
aliases: [effect ingestion, effect scraping, effect resilient fetch, effect data pipeline recipe]
tags: [type/recipe, tech/typescript, tech/effect-ts]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/quickstart]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[effect-ts/typed-errors]]"
  - "[[effect-ts/composition]]"
  - "[[effect-ts/retry-and-schedule]]"
  - "[[effect-ts/scoped-resources]]"
  - "[[effect-ts/ecosystem-map]]"
source:
  - https://effect.website/docs/error-management/retrying/
  - https://effect.website/docs/getting-started/creating-effects/
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Schema.ts
---

> Fetching data from a flaky upstream is the canonical "looks fine in the happy path, silently corrupts in production" problem: a missed timeout, a parse failure, or one bad row in a batch all degrade quietly. This recipe composes `Effect.tryPromise`, `Schema`, `Effect.timeout`, `Effect.retry`, and `Effect.forEach` into a pipeline where every failure mode is typed and explicit.

## Setup

```bash
npm install effect
```

Everything used here lives in the core `effect` module: `Effect`, `Schedule`, `Schema` ([packages/effect/src/Schema.ts](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Schema.ts)), `Console`.

## The brittle version

Before the resilient pipeline, here's what most code looks like and why it fails. The plain-`Promise` version is six lines and has four silent failure modes:

```typescript
async function fetchTodo(id: number) {
  const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`);
  const body = (await res.json()) as { id: number; title: string };
  return body;
}

const todos = await Promise.all([1, 2, 3, 4, 5].map(fetchTodo));
```

What this hides:

1. **Network errors** reject the promise with `unknown`; the type system doesn't tell you which `await` to handle.
2. **HTTP 404 / 500** never throw: `fetch` only rejects on network failure, not on status. `res.json()` happily parses the error body as a `{ id, title }`.
3. **No timeout**: a hung connection blocks `Promise.all` indefinitely.
4. **No retry**: a single transient failure aborts the whole batch.
5. **Unbounded concurrency**: 1000 IDs in the array fire 1000 simultaneous requests at the upstream.

Each fix below maps to one of those failure modes. Type signatures grow as the program does, which is the point: every transformation makes the contract more honest.

## 1. Wrap `fetch` with [[effect-ts/typed-errors|typed errors]]

`Effect.tryPromise` ([Effect.ts#L4677-L4690](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L4677-L4690), `@since 2.0.0`) wraps a `Promise`-returning function and lets you map the rejection into a typed error. Replace silent `unknown` rejections with discriminated `_tag` failures:

```typescript
import { Data, Effect } from "effect";

class FetchError extends Data.TaggedError("FetchError")<{ readonly cause: unknown }> {}
class HttpError extends Data.TaggedError("HttpError")<{ readonly status: number }> {}

//      ┌─── Effect<Response, FetchError | HttpError, never>
//      ▼
const fetchRaw = (url: string) =>
  Effect.tryPromise({
    try: (signal) => fetch(url, { signal }),
    catch: (cause) => new FetchError({ cause }),
  }).pipe(
    Effect.flatMap((res) =>
      res.ok ? Effect.succeed(res) : Effect.fail(new HttpError({ status: res.status })),
    ),
  );
```

Two wins from the rewrite:

- The `signal: AbortSignal` argument to `try` is wired automatically: if the effect is interrupted (timeout, or the surrounding [[effect-ts/what-is-effect|fiber]] (Effect's lightweight thread, the unit of concurrency) that's running it is cancelled), the underlying `fetch` is aborted ([Effect.ts#L4634-L4638](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L4634-L4638)).
- HTTP status checks become a typed branch: `HttpError` is in the `E` channel, so `Effect.catchTag("HttpError", ...)` is exhaustive (see [[effect-ts/typed-errors|typed errors]]).

## 2. Parse with `Schema`, not `as`

A `as { id: number; title: string }` cast trusts the upstream. `Schema.decodeUnknown` validates at the boundary and surfaces structural failures as a typed `ParseError`:

```typescript
import { Data, Effect, Schema } from "effect";

const Todo = Schema.Struct({
  userId: Schema.Number,
  id: Schema.Number,
  title: Schema.String,
  completed: Schema.Boolean,
});
type Todo = Schema.Schema.Type<typeof Todo>;

class ParseFailure extends Data.TaggedError("ParseFailure")<{ readonly issues: string }> {}

//      ┌─── Effect<Todo, ParseFailure, never>
//      ▼
const parseTodo = (res: Response) =>
  Effect.tryPromise({
    try: () => res.json(),
    catch: (cause) => new ParseFailure({ issues: `bad JSON: ${String(cause)}` }),
  }).pipe(
    Effect.flatMap((unknown) =>
      Schema.decodeUnknown(Todo)(unknown).pipe(
        Effect.mapError((e) => new ParseFailure({ issues: e.message })),
      ),
    ),
  );
```

Compose the two for the full per-item fetch:

```typescript
//      ┌─── Effect<Todo, FetchError | HttpError | ParseFailure, never>
//      ▼
const fetchTodo = (id: number) =>
  fetchRaw(`https://jsonplaceholder.typicode.com/todos/${id}`).pipe(Effect.flatMap(parseTodo));
```

The `E` channel now lists every distinct failure the function can produce. Forgetting to handle one becomes a compile error downstream.

## 3. Bound the latency: `Effect.timeout`

`Effect.timeout(d)` ([Effect.ts#L7027-L7030](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L7027-L7030), `@since 2.0.0`) adds `TimeoutException` to the error channel. A timeout interrupts the underlying effect ([timing-out docs](https://effect.website/docs/error-management/timing-out/)); combined with `tryPromise`'s `AbortSignal` wiring, the in-flight `fetch` is actually cancelled, not just abandoned.

```typescript
import { Effect } from "effect";

//      ┌─── Effect<Todo, FetchError | HttpError | ParseFailure | TimeoutException, never>
//      ▼
const fetchTodoBounded = (id: number) => fetchTodo(id).pipe(Effect.timeout("5 seconds"));
```

## 4. Retry only the transient failures

Most ingestion failures are transient (`FetchError`, network hiccup, gateway timeout). A `ParseFailure` is not: retrying a malformed payload loops forever. Use `Effect.retry`'s `while` predicate (see [[effect-ts/retry-and-schedule|Retry and Schedule]]) to retry only the right tags, and an exponential schedule capped via `Schedule.intersect`:

```typescript
import { Effect, Schedule } from "effect";

const retryPolicy = Schedule.intersect(
  Schedule.jittered(Schedule.exponential("200 millis")),
  Schedule.recurs(3),
);

//      ┌─── Effect<Todo, FetchError | HttpError | ParseFailure | TimeoutException, never>
//      ▼
const fetchTodoResilient = (id: number) =>
  fetchTodoBounded(id).pipe(
    Effect.retry({
      schedule: retryPolicy,
      while: (err) => err._tag === "FetchError" || err._tag === "TimeoutException",
    }),
  );
```

`HttpError` and `ParseFailure` surface immediately on attempt 1; transient errors retry up to 3 extra times with jittered exponential backoff (200ms, ~400ms, ~800ms).

## 5. Bound the concurrency: `Effect.forEach`

`Promise.all` runs every element at once. `Effect.forEach` ([Effect.ts#L1605-L1620](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L1605-L1620), `@since 2.0.0`) takes a `concurrency` option that caps simultaneous in-flight effects:

```typescript
import { Effect } from "effect";

//      ┌─── Effect<ReadonlyArray<Todo>, FetchError | HttpError | ParseFailure | TimeoutException, never>
//      ▼
const ingest = (ids: ReadonlyArray<number>) =>
  Effect.forEach(ids, fetchTodoResilient, { concurrency: 5 });

Effect.runPromise(ingest([1, 2, 3, 4, 5])).then(console.log);
```

`{ concurrency: 5 }` keeps at most 5 requests in flight; the others wait. `concurrency: "unbounded"` matches `Promise.all`'s behavior; `concurrency: 1` is sequential (the default).

> [!warning] `forEach` short-circuits on first failure
> If item 3 fails after retries, items 4 and 5 are interrupted (their `AbortSignal` fires) and the whole batch fails with the first error. For "ingest as much as possible, log the rest", wrap each item in `Effect.either` so failures land in the success channel as `Either<E, A>` and `forEach` continues. The trade-off: you lose the typed `E` aggregation; recover it by counting `Left` results in the post-pass.

## Putting it together

```typescript
import { Console, Data, Effect, Schedule, Schema } from "effect";

class FetchError extends Data.TaggedError("FetchError")<{ readonly cause: unknown }> {}
class HttpError extends Data.TaggedError("HttpError")<{ readonly status: number }> {}
class ParseFailure extends Data.TaggedError("ParseFailure")<{ readonly issues: string }> {}

const Todo = Schema.Struct({
  userId: Schema.Number,
  id: Schema.Number,
  title: Schema.String,
  completed: Schema.Boolean,
});

const fetchRaw = (url: string) =>
  Effect.tryPromise({
    try: (signal) => fetch(url, { signal }),
    catch: (cause) => new FetchError({ cause }),
  }).pipe(
    Effect.flatMap((res) =>
      res.ok ? Effect.succeed(res) : Effect.fail(new HttpError({ status: res.status })),
    ),
  );

const fetchTodo = (id: number) =>
  fetchRaw(`https://jsonplaceholder.typicode.com/todos/${id}`).pipe(
    Effect.flatMap((res) =>
      Effect.tryPromise({
        try: () => res.json(),
        catch: (cause) => new ParseFailure({ issues: `bad JSON: ${String(cause)}` }),
      }),
    ),
    Effect.flatMap((u) =>
      Schema.decodeUnknown(Todo)(u).pipe(
        Effect.mapError((e) => new ParseFailure({ issues: e.message })),
      ),
    ),
    Effect.timeout("5 seconds"),
    Effect.retry({
      schedule: Schedule.intersect(
        Schedule.jittered(Schedule.exponential("200 millis")),
        Schedule.recurs(3),
      ),
      while: (err) => err._tag === "FetchError" || err._tag === "TimeoutException",
    }),
  );

const program = Effect.forEach([1, 2, 3, 4, 5], fetchTodo, { concurrency: 5 }).pipe(
  Effect.tap((todos) => Console.log(`ingested ${todos.length} todos`)),
);

Effect.runPromise(program).then(console.log).catch(console.error);
```

The full type is `Effect<ReadonlyArray<Todo>, FetchError | HttpError | ParseFailure | TimeoutException, never>`. Every failure mode the brittle version hid is now in the signature; every fix is one operator in the pipe.

## Gotchas

> [!warning] Don't retry non-idempotent ingestion
> The recipe assumes idempotent reads. If your "ingestion" actually mutates state (POST a payment, send an email), retries replay the side effect. Either make the upstream call idempotent (server-side dedup key) or split the pipeline: retry the read, don't retry the write.

> [!info]- Why `Schema.decodeUnknown` and not `Schema.decode`
> `Schema.decode` accepts the schema's encoded type as input (useful when chaining schemas). `Schema.decodeUnknown` accepts `unknown`, which is what `res.json()` returns. Use `decodeUnknown` at the boundary; use `decode` between known-typed layers.

> [!info]- When to reach for `@effect/platform`'s `HttpClient` instead
> `HttpClient` from `@effect/platform` adds typed request/response builders, automatic body decoding, built-in retry policies, and tracing spans. For one-off fetches the plain-`fetch` wrapper above is fine; once you have more than ~3 endpoints or need shared headers, switch. See [[effect-ts/ecosystem-map|Ecosystem map]] for the package layout.

## See also

- [[effect-ts/retry-and-schedule|Retry and Schedule]]: the policy primitives composed in step 4.
- [[effect-ts/typed-errors|Typed errors]]: `Data.TaggedError`, `catchTag`, why the `E` channel matters.
- [[effect-ts/composition|Composition]]: `pipe` is the operator stitching every step together.
- [[effect-ts/what-is-effect|What is Effect]]: the lazy-description model that makes "wrap the whole thing in retry+timeout" a one-liner.
- [Retrying](https://effect.website/docs/error-management/retrying/) (official).
- [Creating effects from `Promise`](https://effect.website/docs/getting-started/creating-effects/#trypromise) (official).
