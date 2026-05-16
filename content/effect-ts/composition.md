---
title: Composition with pipe, gen, and fn
aliases: [effect compose, effect.gen vs effect.fn, effect pipe vs gen, effect composition idioms]
tags: [type/concept, tech/typescript, tech/effect-ts]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[effect-ts/quickstart]]"
  - "[[effect-ts/typed-errors]]"
  - "[[effect-ts/layers-and-di]]"
  - "[[effect-ts/retry-and-schedule]]"
  - "[[effect-ts/scoped-resources]]"
  - "[[effect-ts/fault-tolerant-ingestion]]"
  - "[[effect-ts/ecosystem-map]]"
  - "[[effect-ts/layers-vs-nestjs-di]]"
source:
  - https://effect.website/docs/getting-started/building-pipelines/
  - https://effect.website/docs/getting-started/using-generators/
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts
---

> Effect ships three ways to compose effects: `pipe` for linear value-to-value transforms, `Effect.gen` for branching/looping control flow, and `Effect.fn` for named callables that auto-instrument tracing (every call becomes a span in the built-in tracer, so distributed-trace timelines show one entry per call without manual `withSpan`). They're complementary, not competing. Picking the right one per call site keeps the type signatures readable and the traces useful.

## The three idioms in one minute

```typescript
import { Effect } from "effect";

const fetchUser = (id: string) => Effect.succeed({ name: `user_${id}` });
const sendWelcome = (name: string) => Effect.sync(() => console.log(`welcome, ${name}`));

// 1. pipe — linear: take an Effect, transform it.
//      ┌─── Effect<string, never, never>
//      ▼
const a = fetchUser("u_1").pipe(
  Effect.map((u) => u.name),
  Effect.tap((name) => Effect.log(`got ${name}`)),
);

// 2. Effect.gen — control flow: branch, loop, share intermediate names.
//      ┌─── Effect<void, never, never>
//      ▼
const b = Effect.gen(function* () {
  const user = yield* fetchUser("u_1");
  if (user.name.startsWith("guest_")) return;
  yield* sendWelcome(user.name);
});

// 3. Effect.fn — named callable that auto-creates a tracing span.
//          ┌─── (id: string) => Effect<void, never, never>
//          ▼
const onboard = Effect.fn("onboard")(function* (id: string) {
  const user = yield* fetchUser(id);
  yield* sendWelcome(user.name);
});

Effect.runSync(a);
Effect.runSync(b);
Effect.runSync(onboard("u_2"));
```

Same problem, three shapes. The rest of this note explains when each is the right shape.

## `pipe`: linear transformations

`pipe` is "a utility that allows us to compose functions in a readable and sequential manner. It takes the output of one function and passes it as the input to the next function in the pipeline" ([building-pipelines docs](https://effect.website/docs/getting-started/building-pipelines/)). Effect values also expose a `.pipe(...)` method that does the same thing.

```typescript
import { Effect } from "effect";

declare const fetchUser: (id: string) => Effect.Effect<{ name: string }, Error>;

// .pipe() is the method form; pipe() from "effect" is the standalone form.
//      ┌─── Effect<string, Error, never>
//      ▼
const greeting = fetchUser("u_1").pipe(
  Effect.map((u) => `Hello, ${u.name}!`),
  Effect.tap((g) => Effect.log(g)),
  Effect.catchAll(() => Effect.succeed("Hello, stranger!")),
);
```

`pipe` shines when every step is a one-input/one-output transform: `map`, `flatMap`, `tap`, `catchAll`, `withSpan`, `timeout`, `retry`. The reader scans top-to-bottom and sees a chain of operators applied to one initial effect.

`pipe` becomes awkward when you need to **branch** on an intermediate value, **loop**, or **reuse** an intermediate result later in the chain. That's `gen`'s territory.

## `Effect.gen`: control flow

`Effect.gen` "provides a way to write effectful code using generator functions, simplifying control flow and error handling" ([using-generators docs](https://effect.website/docs/getting-started/using-generators/)). Inside the generator, `yield*` an effect to "await" its result. The compiler unions every yielded error into the gen block's `E`.

```typescript
import { Effect } from "effect";

declare const fetchUser: (id: string) => Effect.Effect<{ name: string; admin: boolean }, Error>;
declare const sendWelcome: (name: string) => Effect.Effect<void, Error>;
declare const sendAdminBriefing: (name: string) => Effect.Effect<void, Error>;

//      ┌─── Effect<string, Error, never>
//      ▼
const program = Effect.gen(function* () {
  const user = yield* fetchUser("u_1");

  // Branch on an intermediate value: trivial in gen, painful in pipe.
  if (user.admin) {
    yield* sendAdminBriefing(user.name);
  } else {
    yield* sendWelcome(user.name);
  }

  // Reuse `user` later. In a pipe chain you'd have to thread it through
  // every step or build a tuple. Here it's just a const.
  return `done: ${user.name}`;
});
```

When to reach for `gen`:

- You need `if/else`, `for`/`while`, or early `return` between effects.
- Two later steps depend on an earlier step's value (so you want a name, not a tuple).
- The error-handling story is "let it propagate"; gen short-circuits on the first failure ([using-generators docs](https://effect.website/docs/getting-started/using-generators/), which recommends `Effect.either` if you need to continue past a failure).

> [!warning]- `Effect.gen` short-circuits on failure
> The first `yield*` that fails ends the generator: nothing after it runs. This is the right default for "the next step depends on the previous step", but it bites if you expected each `yield*` to be independently observable. Use `Effect.either(child)` to lift the failure into the success channel as `Either<E, A>` so the gen block can keep going.

> [!warning]- `Effect.gen` is single-shot: use `pipe` for `Stream`
> JavaScript generators can only be traversed once: once an iterator advances, it cannot rewind. `Effect.gen` inherits this constraint, so it only works for effects that produce **one result** per run. Multi-value producers like `Stream` are not single-shot: they yield items repeatedly. Attempting to `yield*` a `Stream` inside `Effect.gen` doesn't work; use `pipe` with dedicated `Stream.*` operators instead. This is the practical reason the decision table below says "use `pipe` for linear chains on a `Stream`" rather than gen.

## `Effect.fn`: named callables with auto-tracing

`Effect.fn` was added in Effect 3.11.0 ([source L14629-L14684](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L14629-L14684)) and the Effect source's JSDoc names two reasons to prefer it over a plain `(args) => Effect.gen(...)` wrapper:

> "**Stack traces with location details** if an error occurs.
> **Automatic span creation** for tracing when a span name is provided."
> ([Effect.ts L14495-L14497](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L14495-L14497))

The rest of the JSDoc spells out the call shapes:

> "If a span name is passed as the first argument, the function's execution is tracked using that name. If no name is provided, stack tracing still works, but spans are not created. A function can be defined using either: A generator function, allowing the use of `yield*` for effect composition. A regular function that returns an `Effect`."
> ([Effect.ts L14499-L14506](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L14499-L14506))

So you get four call shapes from the same combinator:

```typescript
import { Effect } from "effect";

declare const fetchUser: (id: string) => Effect.Effect<{ name: string }, Error>;

// 1. Anonymous span (stack trace only, no span emitted).
//          ┌─── (id: string) => Effect<{ name: string }, Error, never>
//          ▼
const fn1 = Effect.fn(function* (id: string) {
  return yield* fetchUser(id);
});

// 2. Named span (auto-instruments tracing under the name "fetchUserById").
//          ┌─── (id: string) => Effect<{ name: string }, Error, never>
//          ▼
const fn2 = Effect.fn("fetchUserById")(function* (id: string) {
  return yield* fetchUser(id);
});

// 3. Regular function form (no generator) — also accepted.
//          ┌─── (id: string) => Effect<{ name: string }, Error, never>
//          ▼
const fn3 = Effect.fn("fetchUserById")((id: string) => fetchUser(id));

// 4. With pipe-style transforms applied after the body.
//          ┌─── (id: string) => Effect<{ name: string }, Error, never>
//          ▼
const fn4 = Effect.fn("fetchUserById")(
  function* (id: string) {
    return yield* fetchUser(id);
  },
  // Each extra arg gets (effect, ...originalArgs) and returns the next effect.
  (effect, id) => Effect.withLogSpan(`fetch:${id}`)(effect),
);
```

What that buys you in a real trace:

```typescript
import { Effect } from "effect";

const myfunc = Effect.fn("myspan")(function* <N extends number>(n: N) {
  yield* Effect.annotateCurrentSpan("n", n);
  console.log(`got: ${n}`);
  yield* Effect.fail(new Error("Boom!"));
});

Effect.runFork(myfunc(100).pipe(Effect.catchAllCause(Effect.logError)));
// got: 100
// timestamp=... level=ERROR fiber=#0 cause="Error: Boom!
//     at <anonymous> (/.../index.ts:6:22)  <= Raise location
//     at myspan (/.../index.ts:3:23)       <= Definition location
//     at myspan (/.../index.ts:9:16)"      <= Call location
```

(Example reproduced verbatim from [Effect.ts L14512-L14528](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L14512-L14528). The three labelled stack frames are the value-add over a plain `Effect.gen` wrapper: a generator inside a regular function loses the call-site frame because the generator is invoked lazily by the runtime.)

> [!info]- `Effect.fnUntraced` for the same shape without spans
> If you want the call-shape ergonomics of `Effect.fn` without paying for span creation (e.g. inside a tight loop that runs every request, or a library you don't want to leak telemetry from), use [`Effect.fnUntraced`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L14765). Same overloads, no auto-span. Stack traces still benefit from the named-callable wrapping.

## Picking one per call site

| Situation                                                                                                         | Reach for                     |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Linear chain of operators on one effect (`map`, `tap`, `catchAll`, `timeout`, …).                                 | `pipe`                        |
| You need `if`/`for`/`while`/early-`return` between effect steps.                                                  | `Effect.gen`                  |
| You need to name an intermediate value and reuse it across two later steps.                                       | `Effect.gen`                  |
| You're defining a **named function** that returns an Effect, and you want it to show up as a span in your traces. | `Effect.fn`                   |
| Same as above, but you don't want the span (latency-sensitive call site, library code).                           | `Effect.fnUntraced`           |
| You want an anonymous (no-name) helper used once.                                                                 | `pipe` or inline `Effect.gen` |

These are not exclusive. A typical service method looks like `Effect.fn("createOrder")(function* (input) { ... pipe(...) ... })`: `fn` for the outer name and span, `gen` for the body's branching, `pipe` for any inline transformation on a single intermediate effect.

## What `Effect.fn` is not

- **Not the same as `(...args) => Effect.gen(...)`.** That works and is fine for one-offs. `Effect.fn` adds a named tracing span (the JSDoc demos exporting it via `@effect/opentelemetry`'s `NodeSdk` ([Effect.ts L14538-L14580](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L14538-L14580))) and richer stack traces with the call/definition/raise locations. Behaviorally the body is identical; the wrapper is purely about observability.
- **Not for runtime entry points.** The runners (`Effect.runSync`, `Effect.runPromise`, `Effect.runFork`) still go at the edge of your program; `Effect.fn` is for the definitions inside.

## See also

- [[effect-ts/quickstart|Quickstart]]: install and run a first effect; introduces `Effect.gen`.
- [[effect-ts/what-is-effect|What is Effect]]: the lazy-description model that makes all three idioms equivalent at runtime.
- [[effect-ts/typed-errors|Typed errors]]: how the `E` channel composes inside each idiom.
- [[effect-ts/ecosystem-map|Ecosystem map]]: where the rest of the libraries fit, all of them composed via these three idioms.
- [Building Pipelines](https://effect.website/docs/getting-started/building-pipelines/) (official): the `pipe` reference.
- [Using Generators](https://effect.website/docs/getting-started/using-generators/) (official): the `Effect.gen` reference.
