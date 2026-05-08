---
title: Typed errors
aliases: [effect typed errors, effect error channel, effect catchtag, effect.try recipe]
tags: [type/recipe, tech/typescript, tech/effect-ts, errors]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/quickstart]]"
  - "[[effect-ts/what-is-effect]]"
source:
  - https://effect.website/docs/error-management/expected-errors/
  - https://effect.website/docs/getting-started/creating-effects/
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts
---

> Put failure modes in the type signature, not in `try/catch`. `Effect.fail` declares an error in the `E` channel; `Effect.try` / `Effect.tryPromise` lift fallible code; `Effect.catchTag` discriminates by `_tag` and removes the handled tag from the residual error type.

## Setup

```bash
npm install effect
```

That's it: typed errors are part of the core `effect` package. Examples below assume TypeScript 5.4+ with `strict: true` (Effect's type magic depends on strict mode).

## 1. Declare a tagged error

The `_tag` field is the discriminator the error-handling combinators rely on. Two common patterns:

```typescript
// Pattern A: plain class with a literal _tag.
class NotFoundError {
  readonly _tag = "NotFoundError";
  constructor(readonly id: string) {}
}

// Pattern B: extend Error so stack traces still work.
class NetworkError extends Error {
  readonly _tag = "NetworkError";
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}
```

Use Pattern A for pure domain errors (no stack-trace value), Pattern B when the error wraps something thrown (HTTP failure, parser blowup) and you want the original stack.

> [!info]- `Data.TaggedError` shorthand
> Effect ships `Data.TaggedError("Tag")<{ field: type }>` as a one-liner that defines the class, the `_tag`, the constructor, and equality semantics. Mentioned here so you recognize it in the docs; covered in detail in a future Schema/Data note.

## 2. Lift fallible code into an `Effect`

Synchronous code that might throw → `Effect.try`:

```typescript
import { Effect } from "effect";

class ParseError {
  readonly _tag = "ParseError";
  constructor(readonly cause: unknown) {}
}

const parseJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input) as unknown,
    catch: (cause) => new ParseError(cause),
  });
// parseJson :: (input: string) => Effect<unknown, ParseError, never>

console.log(Effect.runSync(parseJson('{"ok":true}')));
// Output: { ok: true }

// Failure path (the runner throws because we're using runSync without handling).
try {
  Effect.runSync(parseJson("not json"));
} catch (e) {
  console.log("caught:", e);
  // caught: (FiberFailure) ParseError: ... (the underlying ParseError surfaces)
}
```

Async code (a `Promise`) → `Effect.tryPromise` ([creating-effects docs](https://effect.website/docs/getting-started/creating-effects/)):

```typescript
import { Effect } from "effect";

class NetworkError {
  readonly _tag = "NetworkError";
  constructor(readonly cause: unknown) {}
}

const fetchTodo = (id: number) =>
  Effect.tryPromise({
    try: () => fetch(`https://jsonplaceholder.typicode.com/todos/${id}`),
    catch: (cause) => new NetworkError(cause),
  });
// fetchTodo :: (id: number) => Effect<Response, NetworkError, never>
```

The `catch` callback is **optional but strongly recommended**: with it, you map whatever the underlying code threw into a typed error of your choice. Without it, Effect lifts the failure into the built-in `UnknownException` and the resulting `E` is `UnknownException` ([creating-effects docs](https://effect.website/docs/getting-started/creating-effects/#tryPromise) state: "If you don't provide a catch function, the error is caught and the effect fails with an UnknownException"). For anything you want to discriminate later with `catchTag`, supply `catch` so the `E` carries a tag.

## 3. Compose effects; the error channel widens

Inside `Effect.gen`, `yield*` an effect to use its result. The compiler unions every error type yielded into the gen block's `E`:

```typescript
import { Effect } from "effect";

class ParseError {
  readonly _tag = "ParseError";
}
class NetworkError {
  readonly _tag = "NetworkError";
}

declare const fetchTodo: (id: number) => Effect.Effect<Response, NetworkError>;
declare const parseJson: (input: string) => Effect.Effect<unknown, ParseError>;

const getTodo = (id: number) =>
  Effect.gen(function* () {
    const response = yield* fetchTodo(id);
    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () => new NetworkError(),
    });
    const json = yield* parseJson(body);
    return json;
  });
// getTodo :: (id: number) => Effect<unknown, NetworkError | ParseError, never>
//                                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                            E is the union of every error that can occur.
```

You did not annotate `getTodo`'s return type: the compiler inferred the union. Add a new failure mode anywhere in the chain and the type updates; forget to handle it downstream and it's a compile error.

## 4. Recover from a specific error with `catchTag`

`Effect.catchTag` ([source signature](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L3831-L3890)) takes a `_tag` literal, a handler that runs when the matching tag fires, and **removes that tag from the residual `E`**:

```typescript
import { Effect } from "effect";

class HttpError {
  readonly _tag = "HttpError";
}
class ValidationError {
  readonly _tag = "ValidationError";
}

declare const program: Effect.Effect<string, HttpError | ValidationError>;

const recovered = program.pipe(
  Effect.catchTag("HttpError", (_e) => Effect.succeed("fallback after HttpError")),
);
// recovered :: Effect<string, ValidationError, never>
//                              ^^^^^^^^^^^^^^^
//             HttpError has been removed; ValidationError is still possible.
```

The signature uses `Exclude<E, { _tag: K[number] }>` for the residual error type ([source L3882-L3890](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L3882-L3890)): that's how the compiler narrows.

Handle every tag and `E` becomes `never`:

```typescript
const fullyHandled = program.pipe(
  Effect.catchTag("HttpError", () => Effect.succeed("fallback (http)")),
  Effect.catchTag("ValidationError", () => Effect.succeed("fallback (validation)")),
);
// fullyHandled :: Effect<string, never, never>
// runSync / runPromise will not reject for any *expected* error.
// Defects (unrecoverable bugs, throws not lifted into E) are still thrown; see §5.
```

## 5. Recover from anything with `catchAll`

When you don't care which error fired, [`Effect.catchAll`](https://effect.website/docs/error-management/expected-errors/) handles every error in the channel:

```typescript
import { Effect } from "effect";

declare const program: Effect.Effect<string, HttpError | ValidationError>;

const safe = program.pipe(
  Effect.catchAll((error) => Effect.succeed(`recovered from ${error._tag}`)),
);
// safe :: Effect<string, never, never>
```

Note from the docs: "This function only handles recoverable errors." Defects (bugs, throws not lifted into `E`) are NOT caught by `catchAll`; they live in a separate "defect" channel handled by `Effect.catchAllCause` / `Effect.catchAllDefect`. For now, treat `catchAll` as the "I've handled every expected failure" combinator.

## 6. Putting it together

```typescript
import { Effect } from "effect";

class NotFoundError {
  readonly _tag = "NotFoundError";
  constructor(readonly id: string) {}
}
class NetworkError {
  readonly _tag = "NetworkError";
}
class ParseError {
  readonly _tag = "ParseError";
}

declare const fetchUser: (
  id: string,
) => Effect.Effect<{ id: string; name: string }, NotFoundError | NetworkError | ParseError>;

const getDisplayName = (id: string) =>
  fetchUser(id).pipe(
    Effect.map((user) => user.name),
    Effect.catchTag("NotFoundError", (e) => Effect.succeed(`<unknown user ${e.id}>`)),
    Effect.catchTags({
      NetworkError: () => Effect.succeed("<service unavailable>"),
      ParseError: () => Effect.succeed("<bad response>"),
    }),
  );
// getDisplayName :: (id: string) => Effect<string, never, never>
// Every failure mode handled; the runner cannot reject.

console.log(await Effect.runPromise(getDisplayName("u_42")));
```

`Effect.catchTags` is the multi-tag form: pass an object whose keys are tag literals and values are handlers. Same residual-narrowing semantics as `catchTag`, less typing for 3+ tags.

## Common gotchas

> [!warning] `Effect.runSync` rethrows; it does NOT silently absorb errors
> Forgetting to handle an error in the `E` channel before calling `runSync` results in a thrown `FiberFailure` wrapping your error. Either handle every tag (so `E` is `never`) or use `Effect.runPromiseExit` / `Effect.either` to get a result type that names success and failure explicitly.

> [!warning] Omit the `catch` callback and you get `UnknownException`, not a tagged error
> `Effect.try` and `Effect.tryPromise` accept `catch` as **optional**. Without it, failures land in the error channel as the built-in `UnknownException` ([docs](https://effect.website/docs/getting-started/creating-effects/#tryPromise)): the call still type-checks, but the resulting `E` carries no `_tag` you defined, so `Effect.catchTag("YourTag", ...)` cannot narrow it. Supply `catch` whenever you want the failure to be discriminable downstream.

> [!warning] `_tag` collisions silently merge error cases
> `Effect.catchTag("X", ...)` matches any error whose `_tag === "X"`. If two unrelated error classes both use `_tag = "Error"`, the handler fires for both and the `Exclude` removes both from the residual `E`. Pick distinct, namespaced tags (`"User.NotFound"`, `"Db.Timeout"`) once your taxonomy grows.

## See also

- [[effect-ts/quickstart|Quickstart]]: minimal install + first-program walkthrough.
- [[effect-ts/what-is-effect|What is Effect]]: the `E` channel in the broader `Effect<A, E, R>` model.
- [Expected errors page](https://effect.website/docs/error-management/expected-errors/) (official).
- [`Effect.catchTag` source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L3831-L3890).
