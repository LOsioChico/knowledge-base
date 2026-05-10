---
title: Layers and dependency injection
aliases: [effect layers, effect di, effect.service, context.tag, layer.provide, the r channel]
tags: [type/concept, tech/typescript, tech/effect-ts]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[effect-ts/quickstart]]"
  - "[[effect-ts/typed-errors]]"
  - "[[effect-ts/composition]]"
  - "[[effect-ts/ecosystem-map]]"
source:
  - https://effect.website/docs/requirements-management/services/
  - https://effect.website/docs/requirements-management/layers/
  - https://effect.website/docs/requirements-management/layer-memoization/
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts
---

> The `R` channel of `Effect<A, E, R>` is the typed dependency graph. You declare a service with a `Tag`, build an implementation as a `Layer`, and `Effect.provide` it. The compiler refuses to run an effect whose `R` is not `never`, so missing dependencies are compile errors, not runtime crashes.

## Why "DI in the type"

A traditional dependency-injection container is a runtime registry: services are registered by string token or class identity, resolved when asked, and "service not found" is a runtime exception. Effect moves the same pattern into the type system:

- The set of services an effect needs is the union in its `R` channel.
- Providing a service via `Effect.provide` **subtracts** that service's tag from `R`.
- When `R` reaches `never`, the effect is runnable. The compiler enforces this.

You get the modular structure of DI with the missing-dependency check at compile time. No string tokens, no decorator metadata, no application-startup container bootstrap.

## Declaring a service

A service is two things: a unique tag (identifier) and an interface (the operations it exposes). Effect ships two ways to declare both, depending on how much ceremony you want.

### `Context.Tag` (the foundation)

The base API. You define a class that extends `Context.Tag(<key>)` parameterized by `<Self, Shape>`:

```typescript
import { Context, Effect } from "effect";

class Random extends Context.Tag("MyRandomService")<
  Random,
  { readonly next: Effect.Effect<number, never, never> }
>() {}
```

The string `"MyRandomService"` is the tag's runtime identity (used for memoization and equality). The first type parameter (`Random`) is the **self-reference** : the class refers to itself so `yield* Random` returns the right shape. The second is the service's interface.

Use the tag inside `Effect.gen` by `yield*`-ing it:

```typescript
//        ┌─── Effect<number, never, Random>
//        ▼
const program = Effect.gen(function* () {
  const random = yield* Random;
  return yield* random.next;
});
```

The `R` channel automatically includes `Random`: the compiler sees you used the tag and tracks the requirement.

### `Effect.Service` (the modern shortcut)

Added in `effect@3.9.0` as `@experimental` ([source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L13585-L13620)), `Effect.Service` collapses the tag + layer declaration into one class. It "simplifies the creation and management of services in Effect by defining both a `Tag` and a `Layer`" ([source comment](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L13540-L13583)).

```typescript
import { Effect } from "effect";

class Random extends Effect.Service<Random>()("MyRandomService", {
  sync: () => ({
    next: Effect.sync(() => Math.random()),
  }),
}) {}

// Random.Default :: Layer<Random, never, never>
```

`Random.Default` is the auto-generated layer; you provide it with `Effect.provide(program, Random.Default)`. The variant keys map to the layer constructors below (`succeed`, `sync`, `effect`, `scoped`).

> [!info]- When to pick which API
> `Context.Tag` for libraries (stable since 2.0, no experimental flag) and for cases where one tag must support multiple interchangeable layer implementations. `Effect.Service` for application code where one service has one obvious construction strategy and you want less boilerplate.

## Building a Layer

A `Layer<ROut, E, RIn>` is a recipe for **constructing** services of type `ROut`, possibly failing with `E`, requiring services of type `RIn` to build itself ([Layer module](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts)). Three constructors cover almost every case:

| Constructor                                                                                        | Use when                                                                           | RIn                                         |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| [`Layer.succeed`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts#L772) | The implementation is a static value, no construction effects.                     | `never`                                     |
| [`Layer.effect`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts#L289)  | Construction is itself an effect (reads other services, runs I/O).                 | inferred from the construction effect's `R` |
| [`Layer.scoped`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts#L727)  | The service holds a resource that needs cleanup (DB pool, file handle, websocket). | inferred, with `Scope` excluded             |

```typescript
import { Context, Effect, Layer } from "effect";

class Config extends Context.Tag("Config")<
  Config,
  { readonly logLevel: string; readonly dbUrl: string }
>() {}

class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (msg: string) => Effect.Effect<void> }
>() {}

//      ┌─── Layer<Config, never, never>
//      ▼
const ConfigLive = Layer.succeed(Config, {
  logLevel: "INFO",
  dbUrl: "postgres://localhost/app",
});

//      ┌─── Layer<Logger, never, Config>   (needs Config to build)
//      ▼
const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config;
    return {
      log: (msg) => Effect.sync(() => console.log(`[${config.logLevel}] ${msg}`)),
    };
  }),
);
```

### `Layer.scoped` for resources with cleanup

When a service owns a finalizable resource, declare it with `Layer.scoped`. The construction effect uses `Effect.acquireRelease` (or `Effect.addFinalizer`); Effect runs the release on shutdown, even if the program is interrupted ([Layer.scoped source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts#L727)).

```typescript
import { Context, Effect, Layer } from "effect";

class Database extends Context.Tag("Database")<
  Database,
  { readonly query: (sql: string) => Effect.Effect<unknown> }
>() {}

const DatabaseLive = Layer.scoped(
  Database,
  Effect.acquireRelease(
    Effect.sync(() => {
      console.log("opening pool");
      return { query: (sql: string) => Effect.sync(() => `result: ${sql}`) };
    }),
    () => Effect.sync(() => console.log("closing pool")),
  ),
);
// "closing pool" runs guaranteed at program end.
```

## Providing a layer

[`Effect.provide`](https://effect.website/docs/requirements-management/services/) takes an effect and a layer; it returns an effect with the layer's outputs **removed** from the requirements channel:

```typescript
//          ┌─── Effect<void, never, Logger>
//          ▼
declare const program: Effect.Effect<void, never, Logger>;

//          ┌─── Effect<void, never, Config>   (Logger satisfied; Config still needed)
//          ▼
const partlyProvided = program.pipe(Effect.provide(LoggerLive));

//        ┌─── Effect<void, never, never>   (everything satisfied; runnable)
//        ▼
const runnable = partlyProvided.pipe(Effect.provide(ConfigLive));
Effect.runSync(runnable);
```

For services with a single static value, `Effect.provideService(tag, value)` is a one-liner that skips the layer ceremony. Both produce the same `R`-narrowing behavior; layers compose, raw values don't.

## Composing layers

Two operators ([Layer module](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts#L567), [`Layer.provide` source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts#L899)):

- **`Layer.merge(a, b)`** : parallel union. The result produces the services of both, and requires the union of what both require. Use when two layers are siblings.
- **`Layer.provide(outer, inner)`** : sequential [[effect-ts/composition|composition]]. `inner`'s outputs feed `outer`'s requirements. Use when one layer depends on another.

```typescript
import { Layer } from "effect";

//      ┌─── Layer<Config | Logger, never, Config>
//      ▼            (Logger requires Config; merge keeps Config in RIn)
const AppConfig = Layer.merge(ConfigLive, LoggerLive);

//      ┌─── Layer<Logger, never, never>   (Config now satisfied internally)
//      ▼
const LoggerWithConfig = Layer.provide(LoggerLive, ConfigLive);

//      ┌─── Layer<Database, never, never>
//      ▼
const AppLive = DatabaseLive.pipe(Layer.provide(LoggerWithConfig), Layer.provide(ConfigLive));
```

The `provide` signature is the one to internalize ([source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts#L899-L903)): `Layer<RIn2, E2, ROut2 | Exclude<R, ROut>>` : the inner layer's outputs are subtracted from the outer's requirements.

## Memoization (default; usually invisible)

"Layers are shared by default" ([memoization docs](https://effect.website/docs/requirements-management/layer-memoization/)): if `LoggerLive` appears twice in the dependency graph (e.g. both `DatabaseLive` and `MetricsLive` depend on it), it's built **once** per `Effect.provide` call, and both consumers see the same instance. This matters for layers that allocate resources (connection pools, caches): you don't want two pools just because two services asked for `Database`.

Two escape hatches when you need a fresh instance:

- **[`Layer.fresh(layer)`](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts#L397)** : strips memoization for one usage; the layer is built independently each time it appears.
- **Define the layer inside a function** : calling the function returns a new `Layer` value, defeating reference-equality memoization. The docs warn against this accidentally: "call that function once and re-use the resulting layer" ([memoization docs](https://effect.website/docs/requirements-management/layer-memoization/)).

```typescript
import { Context, Effect, Layer } from "effect";

class Counter extends Context.Tag("Counter")<Counter, { readonly id: number }>() {}

let next = 0;
const CounterLive = Layer.effect(
  Counter,
  Effect.sync(() => {
    next += 1;
    console.log(`built Counter #${next}`);
    return { id: next };
  }),
);

// Memoized: built once, even though merge references CounterLive twice.
const Memoized = Layer.merge(CounterLive, CounterLive);
Effect.runSync(Effect.gen(function* () {}).pipe(Effect.provide(Memoized)));
// Output:
// built Counter #1

// Layer.fresh: built independently each time it appears.
const Fresh = Layer.merge(CounterLive, Layer.fresh(CounterLive));
Effect.runSync(Effect.gen(function* () {}).pipe(Effect.provide(Fresh)));
// Output:
// built Counter #2
// built Counter #3
```

> [!warning]- Memoization is per-`Effect.provide`, not global
> Two separate `Effect.provide(LoggerLive)` calls on two unrelated effects produce two separate `Logger` instances. Memoization shares within one provision graph; the unit of sharing is the call. If you need a single global instance, build the layer once at program entry and reuse the resulting `runtime`.

## Common gotchas

> [!warning]- Forgetting to provide a service is a compile error, not a runtime one
>
> ```typescript
> // Effect.runSync(program) // ❌ Type 'Logger' is not assignable to type 'never'.
> ```
>
> The error message names the unsatisfied requirement. Read the `R` channel in the type to see exactly what's missing.

> [!info]- `Effect.Service` is `@experimental`
> Per the [source comment](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Effect.ts#L13582), the API "might be up for breaking changes". Pin the `effect` version if you adopt it widely; check release notes when upgrading. `Context.Tag` + `Layer` is the stable foundation if you want zero risk.

> [!warning]- Constructing a layer inside a function defeats memoization
>
> ```typescript
> const makeLogger = (level: string) => Layer.succeed(Logger, { log: ... });
> // Calling makeLogger("INFO") twice produces two distinct layers; both will run.
> ```
>
> Build once, reuse the resulting `Layer` value.

## See also

- [[effect-ts/what-is-effect|What is Effect]]: the `R` channel in the broader `Effect<A, E, R>` model.
- [[effect-ts/typed-errors|Typed errors]]: the `E` channel; same compiler-driven philosophy applied to failures.
- [Effect services docs](https://effect.website/docs/requirements-management/services/) (official).
- [Effect layers docs](https://effect.website/docs/requirements-management/layers/) (official).
- [Layer memoization](https://effect.website/docs/requirements-management/layer-memoization/) (official).
