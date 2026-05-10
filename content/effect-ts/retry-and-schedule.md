---
title: Retry and Schedule
aliases: [effect retry, effect schedule, effect backoff, effect retryorelse]
tags: [type/recipe, tech/typescript, tech/effect-ts]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[effect-ts/typed-errors]]"
  - "[[effect-ts/composition]]"
  - "[[effect-ts/fault-tolerant-ingestion]]"
source:
  - https://effect.website/docs/error-management/retrying/
  - https://effect.website/docs/scheduling/built-in-schedules/
  - https://effect.website/docs/scheduling/schedule-combinators/
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Schedule.ts
---

> Retry a failing effect with `Effect.retry` and a `Schedule`: a value that decides whether to recur and how long to wait between attempts. Schedules compose, so "exponential backoff capped at 5 retries with jitter" is one expression, not a hand-rolled loop.

## Setup

```bash
npm install effect
```

No other packages: `Effect`, `Schedule`, and `Console` all live in the core `effect` module ([packages/effect/src/Schedule.ts](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Schedule.ts), [Effect.ts#L4400-L4410](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L4400-L4410)).

## 1. Retry N times

The smallest case: try up to 3 extra times, then fail. `Effect.retry` is `@since 2.0.0` ([Effect.ts#L4399](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L4399-L4410)) and accepts an options object with a `times` key.

```typescript
import { Effect } from "effect";

let count = 0;
const flaky = Effect.try({
  try: () => {
    count++;
    if (count < 3) throw new Error(`attempt ${count} failed`);
    return `ok on attempt ${count}`;
  },
  catch: (e) => e as Error,
});

//      ┌─── Effect<string, Error, never>
//      ▼
const program = Effect.retry(flaky, { times: 3 });

console.log(Effect.runSync(program));
// Output: ok on attempt 3
```

`{ times: 3 }` means "up to 3 extra attempts after the first", so 4 total. If the effect still fails, the original error propagates ([retrying docs](https://effect.website/docs/error-management/retrying/#retry)).

## 2. Exponential backoff

Pass a `Schedule` instead of `times` for richer control. `Schedule.exponential("10 millis")` produces delays of `10ms, 20ms, 40ms, 80ms, ...` (formula `base * 2^n` per the [built-in schedules docs](https://effect.website/docs/scheduling/built-in-schedules/#exponential)).

```typescript
import { Effect, Schedule } from "effect";

const fetchUser = Effect.fail(new Error("network down"));

//      ┌─── Effect<never, Error, never>
//      ▼
const withBackoff = fetchUser.pipe(Effect.retry(Schedule.exponential("10 millis")));

// Effect.runPromise(withBackoff) // would retry forever; see next section to cap it.
```

`Schedule.exponential` recurs **indefinitely** by itself. You almost always want to cap it.

## 3. Cap retries with `Schedule.intersect`

`Schedule.intersect(a, b)` continues only while **both** schedules want to continue, using the longer delay ([schedule combinators docs](https://effect.website/docs/scheduling/schedule-combinators/#intersect)). Pair an unbounded backoff with `Schedule.recurs(n)` to bound it.

```typescript
import { Console, Effect, Schedule } from "effect";

let attempts = 0;
const flaky = Effect.sync(() => {
  attempts++;
  return attempts;
}).pipe(Effect.flatMap((n) => (n < 4 ? Effect.fail(new Error(`fail ${n}`)) : Effect.succeed(n))));

const policy = Schedule.intersect(
  Schedule.exponential("10 millis"),
  Schedule.recurs(5), // at most 5 retries
);

const program = flaky.pipe(
  Effect.retry(policy),
  Effect.tap((n) => Console.log(`succeeded after ${n} attempts`)),
);

attempts = 0;
Effect.runPromise(program).catch(console.error);
// Output (after ~70ms of backoff): succeeded after 4 attempts
```

This is the workhorse policy for ingestion: bounded attempts, growing delays.

## 4. Add jitter

Without jitter, every client retrying on the same outage hits the upstream at the same moments (the "thundering herd"). `Schedule.jittered` randomises each interval to 80%-120% of its nominal value ([schedule combinators docs](https://effect.website/docs/scheduling/schedule-combinators/#jittered)).

```typescript
import { Schedule } from "effect";

const policy = Schedule.intersect(
  Schedule.jittered(Schedule.exponential("100 millis")),
  Schedule.recurs(5),
);
// Each delay is multiplied by a random factor in [0.8, 1.2].
```

Reach for `jittered` whenever multiple clients can fail simultaneously (network outage, dependency redeploy, rate-limit window).

## 5. Retry only on specific errors

`Effect.retry` accepts `until` and `while` predicates over the failure type (the `E` in `Effect<A, E, R>`) ([retrying docs](https://effect.website/docs/error-management/retrying/#retry)). Use this when only some failures are worth retrying (transient network errors, yes; bad-input errors, no).

```typescript
import { Data, Effect } from "effect";

class TransientError extends Data.TaggedError("TransientError")<{}> {}
class FatalError extends Data.TaggedError("FatalError")<{}> {}

let n = 0;
const op = Effect.suspend(() => {
  n++;
  if (n === 1) return Effect.fail(new TransientError());
  if (n === 2) return Effect.fail(new FatalError());
  return Effect.succeed("done");
});

const program = op.pipe(Effect.retry({ while: (err) => err._tag === "TransientError" }));
// program :: Effect<string, TransientError | FatalError, never>

n = 0;
Effect.runPromiseExit(program).then((exit) => console.log(exit._tag));
// Output: Failure  (FatalError surfaces immediately on attempt 2; not retried)
```

`while` keeps retrying while the predicate is true; `until` is the inverse.

## 6. Fallback when retries are exhausted

`Effect.retryOrElse` runs a fallback effect after the policy gives up ([Effect.ts#L4490-L4502](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L4490-L4502)). Use it for "best-effort: try the live API; if it stays down, return cached data."

```typescript
import { Console, Effect, Schedule } from "effect";

const liveFetch = Effect.fail(new Error("upstream down"));
const cached = Effect.succeed({ id: "u_1", name: "Ada (cached)" });

const policy = Schedule.addDelay(Schedule.recurs(2), () => "50 millis");

//      ┌─── Effect<{ id: string; name: string }, never, never>
//      ▼
const resilient = Effect.retryOrElse(liveFetch, policy, (err, _attempts) =>
  Console.log(`giving up on live: ${err.message}`).pipe(Effect.flatMap(() => cached)),
);

Effect.runPromise(resilient).then(console.log);
// Output:
// giving up on live: upstream down
// { id: 'u_1', name: 'Ada (cached)' }
```

The result's success type becomes a union of both success types (the original `A` widens to `A | B`); the failure type is whatever the fallback declares.

## Built-in schedules at a glance

| Schedule                             | What it does                                                                                                                      | Use for                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `Schedule.recurs(n)`                 | Recurs `n` extra times then stops ([docs](https://effect.website/docs/scheduling/built-in-schedules/#recurs)).                    | Hard retry cap.                                  |
| `Schedule.spaced(d)`                 | Recurs forever, `d` between end of last run and start of next.                                                                    | Polling at a steady pace.                        |
| `Schedule.fixed(d)`                  | Recurs forever at fixed wall-clock interval `d`.                                                                                  | Cron-like cadence; prevents drift on slow tasks. |
| `Schedule.exponential(base, factor)` | Delays grow `base * factor^n`; default factor 2 ([docs](https://effect.website/docs/scheduling/built-in-schedules/#exponential)). | Backoff for transient failures.                  |
| `Schedule.jittered(s)`               | Wraps a schedule, multiplying each interval by 0.8-1.2.                                                                           | Anti-herd: many clients failing together.        |
| `Schedule.forever`                   | Recurs indefinitely with 0ms delays.                                                                                              | Building block; rarely used alone.               |
| `Schedule.once`                      | Single recurrence then stops.                                                                                                     | "Try one more time" semantics.                   |
| `Schedule.intersect(a, b)`           | Continues only while both continue; uses **longer** delay.                                                                        | "Backoff AND cap": exponential ∩ recurs(5).      |
| `Schedule.union(a, b)`               | Continues while either continues; uses **shorter** delay.                                                                         | "Whichever fires first".                         |

## Gotchas

> [!warning] `Schedule.exponential` retries forever by itself
> The schedule is unbounded. Always combine it with `Schedule.recurs(n)` via `Schedule.intersect`, or add a `times`/`until` option, or use `Schedule.upTo` to bound by total elapsed time. Forgetting this turns a transient outage into an infinite loop.

> [!info]- Why `intersect` and not `compose`
> `Schedule.compose(a, b)` chains `b` after `a` finishes; that's not what you want for "cap exponential at 5 retries". `intersect` runs both side-by-side and stops as soon as either one stops, which is the bounding semantics ([schedule combinators docs](https://effect.website/docs/scheduling/schedule-combinators/#intersect)).

> [!warning] Don't retry non-idempotent effects blindly
> `Effect.retry` re-runs the effect end-to-end. If the effect mutates external state (POST without an idempotency key, sends an email, charges a card), retrying replays the mutation. Either make the effect idempotent (server-side dedup key) or split it: retry the read, don't retry the write.

> [!info]- `Effect.repeat` vs `Effect.retry`
> `Effect.retry` recurs on **failure**; `Effect.repeat` recurs on **success**. Same `Schedule` machinery, opposite trigger. `repeat` is for "poll this every 30s until it returns truthy"; `retry` is for "this might fail; try again".

## See also

- [[effect-ts/typed-errors|Typed errors]]: tag your errors so `while`/`until` predicates can discriminate transient vs fatal.
- [[effect-ts/composition|Composition]]: `Effect.retry` is one of the operators that fits naturally into a `pipe` chain.
- [[effect-ts/what-is-effect|What is Effect]]: the laziness that makes "retry the whole thing" a one-liner.
- [Retrying](https://effect.website/docs/error-management/retrying/) (official).
- [Built-in schedules](https://effect.website/docs/scheduling/built-in-schedules/) (official).
- [Schedule combinators](https://effect.website/docs/scheduling/schedule-combinators/) (official).
