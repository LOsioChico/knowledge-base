---
title: Quickstart
aliases: [effect quickstart, effect hello world, effect first program]
tags: [type/recipe, tech/typescript, tech/effect-ts]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[effect-ts/typed-errors]]"
  - "[[effect-ts/layers-and-di]]"
source:
  - https://effect.website/docs/getting-started/installation/
  - https://effect.website/docs/getting-started/creating-effects/
  - https://effect.website/docs/getting-started/running-effects/
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts
---

> Install `effect`, write a tiny program, run it three different ways, then handle a typed error. The 10-minute path from "I've heard of Effect" to "I have a working `Effect<A, E, R>` in front of me".

## Before you start

You need:

- **TypeScript 5.4 or newer** ([install docs](https://effect.website/docs/getting-started/installation/#manual-installation)).
- A TypeScript runtime: **Node.js, Deno, or Bun** are supported (the `effect` package declares no `engines` field, so any modern version works; pick whatever your project already uses).
- A new project. The fastest setup with Node + tsx:

  ```bash
  mkdir effect-quickstart && cd effect-quickstart
  npm init -y
  npm install effect
  npm install -D typescript tsx @types/node
  npx tsc --init --target es2022 --module nodenext --moduleResolution nodenext --strict
  ```

  `tsx` runs `.ts` files directly, no build step. Strict mode matters: Effect's type magic depends on it.

## 1. Write your first effect

Create `src/hello.ts`:

```typescript
import { Effect } from "effect";

// Effect.sync wraps a synchronous side effect into an Effect<void, never, never>.
// The function inside is NOT run yet — `program` is just a description.
const log = (message: string) =>
  Effect.sync(() => {
    console.log(message);
  });

const program = log("Hello, Effect!");
```

Two things to internalize from this snippet:

1. **`program` is a value, not a side effect.** Importing this file logs nothing. The `console.log` only fires when a runtime executes `program`.
2. **The type is `Effect<void, never, never>`**: succeeds with `void`, can't fail (`never` in the error channel), needs no dependencies (`never` in the requirements channel).

## 2. Run it

Effect ships three entry points to bridge from "description" to "execution" ([running-effects docs](https://effect.website/docs/getting-started/running-effects/)). Add to `src/hello.ts`:

```typescript
// runSync: execute synchronously, return the success value.
// Throws if the effect fails or contains async work.
Effect.runSync(program);
// Output: Hello, Effect!

// runPromise: execute and return a Promise of the success value.
// The Promise rejects if the effect fails.
const succeeded = Effect.runPromise(Effect.succeed(1));
succeeded.then(console.log);
// Output: 1

// runFork: execute and return a Fiber. The foundational runner;
// you observe or interrupt the fiber. Use this for long-running work.
const fiber = Effect.runFork(program);
// Output: Hello, Effect!
```

Run it: `npx tsx src/hello.ts`. You should see `Hello, Effect!` (twice) and `1`.

> [!info]- Which runner to use
> `runSync` for code paths you know are synchronous (config parsing, pure transforms). `runPromise` to interop with `async/await`-shaped code (Express handlers, test bodies). `runFork` for fire-and-forget background work where you want a fiber handle to interrupt later.

## 3. Compose with `Effect.gen`

Effect's idiomatic composition is the generator DSL: `yield*` an effect to "await" its result inside another effect. Same shape as `async/await`, but for `Effect`. Replace the body of `src/hello.ts`:

```typescript
import { Effect } from "effect";

const greet = (name: string) => Effect.sync(() => `Hello, ${name}!`);
const log = (message: string) =>
  Effect.sync(() => {
    console.log(message);
  });

const program = Effect.gen(function* () {
  const greeting = yield* greet("Effect");
  yield* log(greeting);
  return greeting.length;
});

const result = Effect.runSync(program);
console.log("returned:", result);
// Output:
// Hello, Effect!
// returned: 14
```

`program` is now `Effect<number, never, never>`: the generator's `return` value becomes the success type. The compiler tracks this without annotations.

## 4. Add a typed error

Real programs fail. The whole point of Effect is that failures show up in the type signature. Wrap a fallible operation with `Effect.try` ([creating-effects docs](https://effect.website/docs/getting-started/creating-effects/#modeling-synchronous-effects)):

```typescript
import { Data, Effect } from "effect";

class ParseError extends Data.TaggedError("ParseError")<{
  readonly message: string;
}> {}

const parseJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input) as unknown,
    catch: (cause) => new ParseError({ message: `invalid JSON: ${String(cause)}` }),
  });
// parseJson :: (input: string) => Effect<unknown, ParseError, never>

const program = Effect.gen(function* () {
  const value = yield* parseJson('{"ok":true}');
  return value;
});

const main = program.pipe(
  Effect.catchTag("ParseError", (e) => Effect.succeed({ recovered: e.message })),
);
// main :: Effect<unknown, never, never>  // E channel is now `never` — error handled.

console.log(Effect.runSync(main));
// Output: { ok: true }
```

The `_tag` field is the discriminator [`Effect.catchTag`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L3831-L3890) uses to narrow which error to handle; after `catchTag("ParseError", ...)`, `ParseError` is **removed from the residual error channel** (the return type is `Exclude<E, { _tag: "ParseError" }>`).

See [[effect-ts/typed-errors|Typed errors]] for the full pattern: multiple error tags, `tryPromise`, `catchAll`, narrowing with `_tag`.

## 5. Where to go next

- [[effect-ts/what-is-effect|What is Effect]]: the mental model behind `Effect<A, E, R>`, the runtime, and why laziness matters.
- [[effect-ts/typed-errors|Typed errors]]: tag your errors, narrow the E channel, recover with `catchTag` / `catchAll`.
- [Effect "Getting Started" docs](https://effect.website/docs/getting-started/introduction/) (official): the next pages cover building pipelines, control flow, and the `Schema` module.

## See also

- [[effect-ts/index|Effect-TS]] (area MOC).
- [Effect installation guide](https://effect.website/docs/getting-started/installation/) (official).
