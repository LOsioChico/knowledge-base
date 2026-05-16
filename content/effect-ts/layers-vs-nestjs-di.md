---
title: Effect Layers vs NestJS DI
aliases:
  - effect vs nest di
  - effect layers vs nestjs di
  - dependency injection comparison effect nest
  - layer vs provider
  - effect.service vs injectable
tags: [type/concept, tech/typescript, tech/effect-ts]
area: effect-ts
status: evergreen
related:
  - "[[effect-ts/index]]"
  - "[[effect-ts/quickstart]]"
  - "[[effect-ts/layers-and-di]]"
  - "[[effect-ts/composition]]"
  - "[[effect-ts/scoped-resources]]"
  - "[[effect-ts/typed-errors]]"
  - "[[effect-ts/what-is-effect]]"
  - "[[nestjs/index]]"
  - "[[nestjs/fundamentals/lifecycle-hooks]]"
  - "[[nestjs/fundamentals/global-providers]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/middleware]]"
source:
  - https://effect.website/docs/requirements-management/services/
  - https://effect.website/docs/requirements-management/layers/
  - https://effect.website/docs/requirements-management/layer-memoization/
  - https://docs.nestjs.com/fundamentals/custom-providers
  - https://docs.nestjs.com/fundamentals/injection-scopes
  - https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts
---

> Both Effect's [[effect-ts/layers-and-di|Layer system]] and NestJS's IoC container solve dependency injection: declare a service, declare what it needs, let the runtime wire it up. They differ on _when_ a missing dependency surfaces (compile time vs application bootstrap), how [[effect-ts/composition|composition]] works (typed graph vs module imports), and how cleanup is modeled (scoped layers vs [[nestjs/fundamentals/lifecycle-hooks|lifecycle hooks]]). This note maps the two side-by-side so you can pick the right tool and, when you must, run both in the same process.

## TL;DR

- **Effect catches missing dependencies at compile time** via the `R` channel of `Effect<A, E, R>` ([source](https://effect.website/docs/requirements-management/services/)); NestJS catches them when the application bootstraps and the IoC container builds the dependency graph ([source](https://docs.nestjs.com/fundamentals/custom-providers#di-fundamentals)). Both reject the program before it serves traffic; only Effect rejects it in the editor.
- **Effect tokens are typed classes** (`Context.Tag` or `Effect.Service`) keyed by a string; NestJS tokens are class identities, strings, or symbols, with `@Inject(token)` for non-class tokens ([source](https://docs.nestjs.com/fundamentals/custom-providers#non-class-based-provider-tokens)).
- **Default lifetime differs**: NestJS singletons by default ([source](https://docs.nestjs.com/fundamentals/injection-scopes#provider-scope)); [[effect-ts/layers-and-di|Effect layers]] are memoized per `Effect.provide` call ([source](https://effect.website/docs/requirements-management/layer-memoization/)). The unit of sharing in Effect is "one provision graph", not "the application".
- **Cleanup belongs to different constructs**: Effect's `Layer.scoped` ties release to the scope that built the layer; NestJS uses `OnModuleDestroy`/`OnApplicationShutdown` lifecycle hooks.
- **They compose**: a NestJS `@Injectable()` can call `Effect.runPromise(program.pipe(Effect.provide(MyLayer)))` and use Effect locally for one operation; the two containers stay separate.

## Mental model side-by-side

| Concept              | Effect                                                                 | NestJS                                                                      |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Service declaration  | `Context.Tag` class or `Effect.Service`                                | `@Injectable()` class or custom provider object                             |
| Token identity       | The class extending `Context.Tag("MyService")`                         | The class itself, or a string/symbol/enum via `@Inject(token)`              |
| Implementation       | A `Layer<ROut, E, RIn>` constructed with `Layer.succeed/effect/scoped` | `useClass`, `useValue`, `useFactory`, or `useExisting`                      |
| Wiring               | `Effect.provide(program, layer)` subtracts `ROut` from `R`             | Add to `providers: [...]`; export from module to share                      |
| Required-by-other    | Inner layer's `ROut` feeds outer layer's `RIn` via `Layer.provide`     | Other module exports the provider; importer adds module to `imports: [...]` |
| Missing dep detected | TypeScript: `R` is not `never`, refuses to compile                     | Runtime at bootstrap: Nest throws "Nest can't resolve dependencies of …"    |
| Default sharing      | Per-`Effect.provide` graph (memoized)                                  | Singleton across the whole application                                      |
| Per-request instance | Build a fresh layer per request and `provide` inside the handler       | `@Injectable({ scope: Scope.REQUEST })`                                     |
| Cleanup hook         | `Layer.scoped` with `Effect.acquireRelease`                            | `OnModuleDestroy` / `OnApplicationShutdown` ([lifecycle hooks][lifehooks])  |
| Test override        | Provide a different `Layer`                                            | `Test.createTestingModule({...}).overrideProvider(X).useValue(...)`         |

[lifehooks]: https://docs.nestjs.com/fundamentals/lifecycle-events

## The same thing in both: a `Logger` and a service that uses it

Two services, one depends on the other. The Effect version pulls from the `R` channel; the NestJS version uses constructor injection.

### Effect

```typescript
import { Context, Effect, Layer } from "effect";

class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (msg: string) => Effect.Effect<void> }
>() {}

class Greeter extends Context.Tag("Greeter")<
  Greeter,
  { readonly greet: (name: string) => Effect.Effect<void> }
>() {}

const LoggerLive = Layer.succeed(Logger, {
  log: (msg) => Effect.sync(() => console.log(`[INFO] ${msg}`)),
});

//      ┌─── Layer<Greeter, never, Logger>  (needs Logger to build itself)
//      ▼
const GreeterLive = Layer.effect(
  Greeter,
  Effect.gen(function* () {
    const logger = yield* Logger;
    return {
      greet: (name: string) => logger.log(`hello, ${name}`),
    };
  }),
);

//        ┌─── Effect<void, never, Greeter>
//        ▼
const program = Effect.gen(function* () {
  const greeter = yield* Greeter;
  yield* greeter.greet("world");
});

// Layer.provide(GreeterLive, LoggerLive): inner Logger feeds outer Greeter.
// Result Layer<Greeter, never, never> — ready to run.
const AppLive = Layer.provide(GreeterLive, LoggerLive);

Effect.runPromise(program.pipe(Effect.provide(AppLive)));
// Output: [INFO] hello, world
```

Forget the `Logger` layer and the program does not compile: `R` is `Logger`, not `never`, so `Effect.runPromise` rejects the argument.

### NestJS

```typescript
import { Injectable, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Injectable()
class Logger {
  log(msg: string) {
    console.log(`[INFO] ${msg}`);
  }
}

@Injectable()
class Greeter {
  // Constructor injection: Nest looks up `Logger` by class identity.
  constructor(private readonly logger: Logger) {}

  greet(name: string) {
    this.logger.log(`hello, ${name}`);
  }
}

@Module({
  providers: [Logger, Greeter],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.get(Greeter).greet("world");
  // Output: [INFO] hello, world
  await app.close();
}
bootstrap();
```

Forget to register `Logger` in `providers` and Nest throws at startup:

```text
Error: Nest can't resolve dependencies of the Greeter (?). Please make sure that the argument Logger at index [0] is available in the AppModule context.
```

> [!info]- Same dependency graph, different feedback loop
> Both systems refuse to run a misconfigured program. Effect's refusal is a red squiggle in your editor before `tsc` finishes; Nest's refusal is a runtime exception during `NestFactory.create(...)`. CI catches both, but Effect catches it the keystroke after you wrote the bug.

## Where they diverge

### 1. When missing dependencies surface

Effect's `R` channel is structural: `Effect.runPromise` is overloaded to accept only `Effect<A, E, never>`, so the compiler rejects any program with an unsatisfied requirement. The error message names the missing tag.

```typescript
import { Context, Effect } from "effect";

class Db extends Context.Tag("Db")<Db, { query: (sql: string) => Effect.Effect<void> }>() {}

const program = Effect.gen(function* () {
  const db = yield* Db;
  yield* db.query("select 1");
});

// Effect.runPromise(program)
// ❌ ts(2345): Argument of type 'Effect<void, never, Db>' is not assignable
//             to parameter of type 'Effect<void, never, never>'.
//             Type 'Db' is not assignable to type 'never'.
```

NestJS catches the same class of bug at application bootstrap. The dependency-graph build "happens during application bootstrapping" and is transitive ([source](https://docs.nestjs.com/fundamentals/custom-providers#di-fundamentals)). The bug never reaches a request handler, but it does reach `node`:

```text
$ node dist/main.js
[Nest] 12345  - 05/16/2026, 12:00:00 PM   ERROR [ExceptionHandler] Nest can't resolve dependencies of the Greeter (?). Please make sure that the argument Logger at index [0] is available in the AppModule context.
```

Practical consequence: Effect lets you refactor a service signature, watch the editor light up everywhere it's used, and chase the requirements one file at a time before re-running anything. NestJS requires a bootstrap cycle to discover the same thing.

### 2. Scope and memoization defaults

NestJS providers are singletons unless you opt out ([source](https://docs.nestjs.com/fundamentals/injection-scopes#provider-scope)):

> A single instance of the provider is shared across the entire application. The instance lifetime is tied directly to the application lifecycle. Once the application has bootstrapped, all singleton providers have been instantiated. Singleton scope is used by default.

Effect layers are memoized **per `Effect.provide` call** ([source](https://effect.website/docs/requirements-management/layer-memoization/)). The unit of sharing is the provision graph: two unrelated `Effect.provide(LoggerLive)` calls build two separate `Logger` instances. To match NestJS's "one per application", build the layer once at process start and reuse the resulting runtime.

```typescript
import { Context, Effect, Layer, ManagedRuntime } from "effect";

class Counter extends Context.Tag("Counter")<Counter, { id: number }>() {}

let next = 0;
const CounterLive = Layer.effect(
  Counter,
  Effect.sync(() => {
    next += 1;
    return { id: next };
  }),
);

// Two separate provisions = two separate Counters.
Effect.runSync(
  Effect.flatMap(Counter, (c) => Effect.sync(() => console.log(`a: ${c.id}`))).pipe(
    Effect.provide(CounterLive),
  ),
);
Effect.runSync(
  Effect.flatMap(Counter, (c) => Effect.sync(() => console.log(`b: ${c.id}`))).pipe(
    Effect.provide(CounterLive),
  ),
);
// Output:
// a: 1
// b: 2

// One ManagedRuntime, reused = one Counter, same as a NestJS singleton.
const runtime = ManagedRuntime.make(CounterLive);
await runtime.runPromise(
  Effect.flatMap(Counter, (c) => Effect.sync(() => console.log(`c: ${c.id}`))),
);
await runtime.runPromise(
  Effect.flatMap(Counter, (c) => Effect.sync(() => console.log(`d: ${c.id}`))),
);
// Output:
// c: 3
// d: 3
```

For per-request instances, NestJS offers `Scope.REQUEST` and `Scope.TRANSIENT` on `@Injectable()` ([source](https://docs.nestjs.com/fundamentals/injection-scopes#usage)). Effect has no built-in request scope: you achieve the equivalent by building a fresh layer per HTTP request and providing it locally. The NestJS approach trades latency for ergonomics: per the docs, "a properly designed application that leverages request-scoped providers should not slow down by more than ~5% latency-wise" ([source](https://docs.nestjs.com/fundamentals/injection-scopes#performance)).

> [!warning]- Request scope propagates upward in NestJS
> "The `REQUEST` scope bubbles up the injection chain. A controller that depends on a request-scoped provider will, itself, be request-scoped" ([source](https://docs.nestjs.com/fundamentals/injection-scopes#scope-hierarchy)). For a multi-tenant data source injected deep in the graph, this can make most of your providers request-scoped accidentally. [Durable providers](https://docs.nestjs.com/fundamentals/injection-scopes#durable-providers) (NestJS 9+) opt the chain into per-tenant DI sub-trees instead of per-request rebuilds. Effect avoids this class of bug by not propagating scope through the type system: a layer's `RIn` doesn't change when you wrap it in something request-scoped.

### 3. Resource cleanup

Both systems can clean up resources, but the mechanism differs.

Effect uses [[effect-ts/scoped-resources|Layer.scoped]] with `Effect.acquireRelease`: the release runs when the layer's scope closes, including on interruption ([source](https://github.com/Effect-TS/effect/blob/main/packages/effect/src/Layer.ts#L727)).

```typescript
import { Context, Effect, Layer } from "effect";

class Db extends Context.Tag("Db")<Db, { query: (sql: string) => Effect.Effect<unknown> }>() {}

const DbLive = Layer.scoped(
  Db,
  Effect.acquireRelease(
    Effect.sync(() => {
      console.log("opening pool");
      return { query: (sql: string) => Effect.sync(() => `result: ${sql}`) };
    }),
    () => Effect.sync(() => console.log("closing pool")),
  ),
);
// "closing pool" runs guaranteed on program end or interruption.
```

NestJS uses [[nestjs/fundamentals/lifecycle-hooks|lifecycle hooks]] on the provider class:

```typescript
import { Injectable, OnModuleDestroy, OnApplicationShutdown } from "@nestjs/common";

@Injectable()
class Db implements OnModuleDestroy, OnApplicationShutdown {
  private pool = (() => {
    console.log("opening pool");
    return { query: (sql: string) => `result: ${sql}` };
  })();

  query(sql: string) {
    return this.pool.query(sql);
  }

  async onModuleDestroy() {
    // Runs during graceful shutdown if enableShutdownHooks() was called.
    console.log("closing pool");
  }

  async onApplicationShutdown(signal?: string) {
    // Also runs on OS signals; pick one hook, not both.
  }
}
```

> [!warning]- NestJS shutdown hooks are opt-in
> `onModuleDestroy` only runs if you wire it: call `app.close()` explicitly, or `app.enableShutdownHooks()` to also listen for SIGTERM/SIGINT. Skip both and your pools leak on `kill <pid>`. Effect's `Layer.scoped` releases on every termination path of the program that built the scope, including interruption: there's no separate "enable shutdown hooks" toggle.

### 4. Swapping implementations for tests

NestJS exposes a first-class override API on the testing module:

```typescript
import { Test } from "@nestjs/testing";

const module = await Test.createTestingModule({
  providers: [Greeter, Logger],
})
  .overrideProvider(Logger)
  .useValue({ log: jest.fn() })
  .compile();

const greeter = module.get(Greeter);
```

Effect's equivalent is just: provide a different layer.

```typescript
import { Effect, Layer } from "effect";

const LoggerTest = Layer.succeed(Logger, {
  log: () => Effect.sync(() => {}),
});

const AppTest = Layer.provide(GreeterLive, LoggerTest);
await Effect.runPromise(program.pipe(Effect.provide(AppTest)));
```

The Effect version stays inside the type system: if `LoggerTest`'s shape drifts from `Logger`'s interface, the compiler refuses the layer. The NestJS version relies on the test author to keep the mock's shape compatible; `useValue` accepts anything ([source](https://docs.nestjs.com/fundamentals/custom-providers#value-providers-usevalue)), then TypeScript's structural typing catches **some** drift at the consumer.

## When to pick which

| You want                                                                  | Reach for                                                                   |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ | ------------ | -------------------------------------------------- |
| HTTP framework with controllers, [[nestjs/fundamentals/guards             | guards]], [[nestjs/fundamentals/interceptors                                | interceptors]], [[nestjs/fundamentals/middleware | middleware]] | NestJS DI (the framework's whole shape assumes it) |
| Maximum compile-time guarantees about wiring                              | Effect layers                                                               |
| Per-request providers without manual layer rebuilding                     | NestJS `Scope.REQUEST` (with `durable: true` for multi-tenant)              |
| Guaranteed cleanup on interruption, no opt-in flag                        | Effect `Layer.scoped`                                                       |
| Swap a service for a test mock with structural-type enforcement           | Effect (`Layer.succeed` with the same `Tag`)                                |
| A dependency-injected GraphQL/REST/microservice app with batteries        | NestJS (Effect has no equivalent of `@Controller`/decorator-driven routing) |
| Typed effects (retry, timeout, structured concurrency) inside one service | Effect inside a NestJS provider (see below)                                 |

## Using both together

The two containers don't merge, but they compose around a clean boundary: a NestJS `@Injectable()` holds onto an Effect runtime (built once with the layers it cares about) and runs Effect programs locally for whatever calls the service makes.

```typescript
import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { Context, Effect, Layer, ManagedRuntime } from "effect";

// Effect side: typed errors + retry for the upstream call.
class Http extends Context.Tag("Http")<
  Http,
  { get: (url: string) => Effect.Effect<string, HttpError> }
>() {}

class HttpError {
  readonly _tag = "HttpError";
  constructor(readonly cause: unknown) {}
}

const HttpLive = Layer.succeed(Http, {
  get: (url) =>
    Effect.tryPromise({
      try: () => fetch(url).then((r) => r.text()),
      catch: (e) => new HttpError(e),
    }),
});

// NestJS side: one Effect runtime per provider, closed on shutdown.
@Injectable()
export class CatalogService implements OnApplicationShutdown {
  private readonly runtime = ManagedRuntime.make(HttpLive);

  fetchListing(id: string) {
    const program = Effect.gen(function* () {
      const http = yield* Http;
      return yield* http
        .get(`https://catalog.example.com/items/${id}`)
        .pipe(Effect.retry({ times: 3 }));
    });
    return this.runtime.runPromise(program);
  }

  async onApplicationShutdown() {
    await this.runtime.dispose();
  }
}
```

The NestJS container owns `CatalogService`'s lifetime; the Effect runtime owns the `Http` service inside. The seam is `runPromise`/`runFork`. This is the practical bridge: keep the framework's DI for the application's shape, reach for Effect when one operation needs [[effect-ts/typed-errors|typed errors]], retries, or structured concurrency the framework doesn't model.

> [!info]- Don't try to register Effect tags as NestJS providers
> The two systems' tokens are not interchangeable. `Context.Tag("Logger")` and a `Logger` class with `@Injectable()` are separate identities even if you name them the same. Pick one container per service: register it with the framework that owns its lifetime.

## See also

- [[effect-ts/layers-and-di|Layers and dependency injection]]: the canonical Effect-side reference (`Context.Tag`, `Effect.Service`, `Layer.provide`, memoization).
- [[effect-ts/scoped-resources|Scoped resources]]: `acquireRelease` and `Layer.scoped` for the cleanup story.
- [[effect-ts/typed-errors|Typed errors]]: the `E` channel; same compile-time philosophy applied to failures rather than dependencies.
- [[effect-ts/what-is-effect|What is Effect]]: the `Effect<A, E, R>` mental model.
- [[nestjs/fundamentals/lifecycle-hooks|Lifecycle hooks]]: `OnModuleDestroy`, `OnApplicationShutdown`, and the `enableShutdownHooks` requirement.
- [[nestjs/fundamentals/global-providers|Global providers]]: how `APP_PIPE`/`APP_GUARD`/`APP_FILTER`/`APP_INTERCEPTOR` plug into the same DI container.
- [Effect: Managing services](https://effect.website/docs/requirements-management/services/) (official).
- [Effect: Managing layers](https://effect.website/docs/requirements-management/layers/) (official).
- [Effect: Layer memoization](https://effect.website/docs/requirements-management/layer-memoization/) (official).
- [NestJS: Custom providers](https://docs.nestjs.com/fundamentals/custom-providers) (official).
- [NestJS: Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes) (official).
