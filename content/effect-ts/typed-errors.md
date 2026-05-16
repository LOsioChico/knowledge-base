---
title: Typed errors
aliases: [effect typed errors, effect error channel, effect catchtag, effect.try recipe]
tags: [type/recipe, tech/typescript, tech/effect-ts, errors, gotchas]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/quickstart]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[effect-ts/layers-and-di]]"
  - "[[effect-ts/composition]]"
  - "[[effect-ts/retry-and-schedule]]"
  - "[[effect-ts/scoped-resources]]"
  - "[[effect-ts/fault-tolerant-ingestion]]"
source:
  - https://effect.website/docs/error-management/expected-errors/
  - https://effect.website/docs/error-management/unexpected-errors/
  - https://effect.website/docs/error-management/error-channel-operations/
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

`Data.TaggedError` is the canonical declaration form ([expected-errors docs](https://effect.website/docs/error-management/expected-errors/)): it adds the `_tag` field, the constructor, and structural equality in one line.

```typescript
import { Data } from "effect";

// Empty payload.
class HttpError extends Data.TaggedError("HttpError")<{}> {}

// Typed payload — the constructor is generated for you.
class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly id: string;
}> {}

// Wrap an underlying cause when the failure originates from a thrown value.
class ParseError extends Data.TaggedError("ParseError")<{
  readonly cause: unknown;
}> {}

const e = new NotFoundError({ id: "u_42" });
console.log(e._tag, e.id);
// Output: NotFoundError u_42
```

> [!info]- Plain class as an alternative
> If you can't import `Data` (older Effect snippets, custom error hierarchies that already extend a project base class), a plain class with a literal `_tag` works the same for `catchTag` discrimination:
>
> ```typescript
> class HttpError {
>   readonly _tag = "HttpError";
> }
> ```
>
> Extend the built-in `Error` if you want a JS stack trace alongside the `_tag`. Either form is recognized by `Effect.catchTag`; `Data.TaggedError` is preferred because the docs lead with it and it gives you constructor + equality for free.

## 2. Lift fallible code into an `Effect`

Synchronous code that might throw → `Effect.try`:

```typescript
import { Data, Effect } from "effect";

class ParseError extends Data.TaggedError("ParseError")<{
  readonly cause: unknown;
}> {}

const parseJson = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input) as unknown,
    catch: (cause) => new ParseError({ cause }),
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
import { Data, Effect } from "effect";

class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly cause: unknown;
}> {}

const fetchTodo = (id: number) =>
  Effect.tryPromise({
    try: () => fetch(`https://jsonplaceholder.typicode.com/todos/${id}`),
    catch: (cause) => new NetworkError({ cause }),
  });
// fetchTodo :: (id: number) => Effect<Response, NetworkError, never>
```

The `catch` callback is **optional**. With it, you map whatever the underlying code threw into a typed error you control. Without it, Effect lifts the failure into the built-in `UnknownException` ([creating-effects docs](https://effect.website/docs/getting-started/creating-effects/#tryPromise) state: "If you don't provide a catch function, the error is caught and the effect fails with an UnknownException"). Use the object form whenever you want the failure to carry a `_tag` you can later discriminate with `catchTag`.

## 3. Compose effects; the error channel widens

Inside `Effect.gen`, `yield*` an effect to use its result. The compiler unions every error type yielded into the gen block's `E`:

```typescript
import { Data, Effect } from "effect";

class ParseError extends Data.TaggedError("ParseError")<{}> {}
class NetworkError extends Data.TaggedError("NetworkError")<{}> {}

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
import { Data, Effect } from "effect";

class HttpError extends Data.TaggedError("HttpError")<{}> {}
class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

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
// Defects (unrecoverable bugs, anything that escapes into Effect.die)
// still kill the fiber; see §5.
```

## 5. Transform without handling with `mapError`

`catchTag` and `catchAll` both _handle_ errors: they run recovery logic and remove the error from the channel. Sometimes you don't want to handle an error at all; you want to **re-type it** so callers see a cleaner abstraction. That's [`Effect.mapError`](https://effect.website/docs/error-management/error-channel-operations/) ([source L5275-L5313](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L5275-L5313)): it transforms `E → E2` and leaves the effect still failing, just with a different type.

The canonical use is wrapping lower-module errors behind an abstraction boundary so the caller doesn't need to know implementation details:

```typescript
import { Data, Effect, pipe } from "effect";

// Lower-module errors — implementation details of the DB layer.
class DbConnectionError extends Data.TaggedError("DbConnectionError")<{}> {}
class DbQueryError extends Data.TaggedError("DbQueryError")<{
  readonly sql: string;
}> {}

// Upper-module error — what the service layer exposes.
class OrderServiceError extends Data.TaggedError("OrderServiceError")<{
  readonly cause: DbConnectionError | DbQueryError;
}> {}

declare const getOrderFromDb: (
  id: string,
) => Effect.Effect<{ id: string; total: number }, DbConnectionError | DbQueryError>;

//      ┌─── Effect<{ id: string; total: number }, OrderServiceError, never>
//      ▼
const getOrder = (id: string) =>
  pipe(
    getOrderFromDb(id),
    // Wrap: the caller sees OrderServiceError, not the DB internals.
    Effect.mapError((cause) => new OrderServiceError({ cause })),
  );
```

The `DbConnectionError | DbQueryError` union disappears from the caller's view; all they see is `OrderServiceError`. This keeps abstraction layers honest: the HTTP handler calling `getOrder` shouldn't need to know whether the failure came from a dropped connection or a bad SQL query.

> [!info]- `mapError` vs `catchTag` in one sentence
> `catchTag` handles and removes a specific error (recovery). `mapError` transforms every error to a new type without removing it (re-typing). If the resulting `E2` is `never`, use `catchAll` instead.

## 6. Recover from anything with `catchAll`

When you don't care which error fired, [`Effect.catchAll`](https://effect.website/docs/error-management/expected-errors/) handles every error in the channel:

```typescript
import { Effect } from "effect";

declare const program: Effect.Effect<string, HttpError | ValidationError>;

const safe = program.pipe(
  Effect.catchAll((error) => Effect.succeed(`recovered from ${error._tag}`)),
);
// safe :: Effect<string, never, never>
```

Note from the docs: "This function only handles recoverable errors." **Defects** are unexpected failures: bugs, things you'd consider unrecoverable. They live in a separate channel and `catchAll` will not touch them. You produce one explicitly with [`Effect.die`](https://effect.website/docs/error-management/unexpected-errors/), and you handle them with `Effect.catchAllCause` / `Effect.catchAllDefect`. For now, treat `catchAll` as the "I've handled every expected failure" combinator.

## 7. Putting it together

```typescript
import { Data, Effect } from "effect";

class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly id: string;
}> {}
class NetworkError extends Data.TaggedError("NetworkError")<{}> {}
class ParseError extends Data.TaggedError("ParseError")<{}> {}

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
> `Effect.try` and `Effect.tryPromise` accept `catch` as **optional**. Without it, failures land in the error channel as the built-in `UnknownException` ([docs](https://effect.website/docs/getting-started/creating-effects/#tryPromise)): the call still type-checks, but the resulting `E` carries no `_tag` you defined, so `Effect.catchTag("YourTag", ...)` cannot narrow it. Use the object form (`{ try, catch }`) when you want the failure to be discriminable downstream.

> [!warning] `_tag` collisions silently merge error cases
> `Effect.catchTag("X", ...)` matches any error whose `_tag === "X"`. If two unrelated error classes both use `_tag = "Error"`, the handler fires for both and the `Exclude` removes both from the residual `E`. Pick distinct, namespaced tags (`"User.NotFound"`, `"Db.Timeout"`) once your taxonomy grows.

## See also

- [[effect-ts/quickstart|Quickstart]]: minimal install + first-program walkthrough.
- [[effect-ts/what-is-effect|What is Effect]]: the `E` channel in the broader `Effect<A, E, R>` model.
- [Expected errors page](https://effect.website/docs/error-management/expected-errors/) (official).
- [`Effect.catchTag` source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L3831-L3890).
