---
title: Interceptors
aliases: [aspect, around-handler]
tags: [type/concept, lifecycle, tech/rxjs]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/recipes/serialization]]"
  - "[[nestjs/recipes/file-uploads]]"
  - "[[nestjs/recipes/trace-id]]"
  - "[[nestjs/recipes/validation]]"
  - "[[nestjs/fundamentals/global-providers]]"
  - "[[nestjs/auth/jwt-strategy]]"
  - "[[nestjs/data/caching]]"
  - "[[nestjs/releases/v10]]"
source:
  - https://docs.nestjs.com/interceptors
  - https://docs.nestjs.com/cli/usages
  - https://github.com/nestjs/nest/tree/master/packages/common/serializer
  - https://github.com/nestjs/nest/blob/master/packages/core/interceptors/interceptors-consumer.ts
  - https://github.com/nestjs/nest/blob/master/packages/core/interceptors/interceptors-context-creator.ts
  - https://github.com/nestjs/nest/blob/master/packages/core/helpers/context-creator.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/serializer/class-serializer.interceptor.ts
  - https://github.com/nestjs/schematics/blob/master/src/lib/interceptor/schema.json
  - https://github.com/nestjs/nest-cli/blob/master/actions/generate.action.ts
  - https://github.com/nestjs/nest-cli/blob/master/commands/generate.command.ts
  - https://docs.nestjs.com/controllers#library-specific-approach
  - https://github.com/nestjs/nest/blob/master/packages/core/helpers/execution-context-host.ts
  - https://github.com/nestjs/graphql/blob/master/packages/graphql/lib/services/gql-execution-context.ts
  - https://github.com/typestack/class-transformer/blob/develop/src/index.ts
  - https://github.com/ReactiveX/rxjs/blob/master/packages/rxjs/src/internal/operators/retry.ts
  - https://docs.nestjs.com/faq/request-lifecycle
  - https://github.com/nestjs/nest-cli/blob/master/lib/utils/project-utils.ts
---

> Wrap the route handler with logic that runs **before and after** it. A single aspect-oriented-programming (AOP) "around" advice (the AOP idiom for code that runs before AND after a wrapped call): built on RxJS (Reactive Extensions for JavaScript, the streams library Nest uses for response transforms), so the response stream is fair game.

## Signature

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    console.log("Before..."); // pre
    const start = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`After ${Date.now() - start}ms`)), // post
    );
  }
}
```

The interface is `NestInterceptor<T, R>`, with two type parameters that describe the **before/after** values:

- `T`: what the handler returns (the value flowing **into** the interceptor via `next.handle(): Observable<T>`).
- `R`: what the interceptor emits **out** to the next layer (`Observable<R>`).

When the interceptor passes the value through unchanged, `T === R` and you can leave both off (that's why the snippet above gets away with `Observable<any>`). When it reshapes the response, the two diverge: see the [wrap-response recipe](#common-recipes), declared as `NestInterceptor<T, { data: T }>`: handler returns `T`, client sees `{ data: T }`.

`intercept()` can also be `async` and return `Promise<Observable<R>>` (Nest awaits before subscribing); the handler stream itself is always an `Observable`.

## Generate with the CLI

```bash
nest generate interceptor logging   # full form
nest g itc logging                  # short alias → src/logging/logging.interceptor.ts
nest g itc logging --flat           # no wrapping folder → src/logging.interceptor.ts
nest g itc common/audit             # nested path → src/common/audit/audit.interceptor.ts
nest g itc common/audit --flat      # nested + flat → src/common/audit.interceptor.ts
nest g itc logging --no-spec        # skip the *.spec.ts test file
nest g itc logging --dry-run        # preview the file plan, write nothing
```

Creates `<name>.interceptor.ts` (and `<name>.interceptor.spec.ts` unless `--no-spec`). The `nest` CLI wraps the file in a folder named after the element by default; pass `--flat` to drop it directly in the target path. Note: the schematic schema declares `"flat": { "default": true }` ([`schema.json`](https://github.com/nestjs/schematics/blob/master/src/lib/interceptor/schema.json)) but `nest g` does not pass that schema default straight through: an absent `--flat` flag enters the CLI path as `false` in [`actions/generate.action.ts`](https://github.com/nestjs/nest-cli/blob/master/actions/generate.action.ts#L58-L69), then [`shouldGenerateFlat()`](https://github.com/nestjs/nest-cli/blob/master/lib/utils/project-utils.ts#L71-L90) returns `true` only for an explicit `--flat` flag or a `generateOptions.flat` boolean in project config. Trust `--dry-run` over the schema. Sources: [`@nestjs/cli` generate command](https://github.com/nestjs/nest-cli/blob/master/commands/generate.command.ts), [Nest CLI usages](https://docs.nestjs.com/cli/usages). Run any of these with `--dry-run` to confirm the exact file plan.

## The pre/post pattern

> [!info] One method, two halves
> `intercept(context, next)` runs **once per request**. Code before `next.handle()` is the **pre** phase; RxJS operators piped onto the returned `Observable` are the **post** phase. NestJS calls this the AOP "Pointcut" pattern: the handler invocation is the pointcut, your interceptor wraps it.

```text
intercept(ctx, next) {
  // ── PRE  ─────────────── runs before the handler
  return next.handle().pipe(
    // ── POST ───────────── runs after the handler emits
  );
}
```

If you **never call** `next.handle()`, the handler is skipped: useful for [[nestjs/data/caching|caching]] (see recipes below). Source: [NestJS Interceptors > Call handler](https://docs.nestjs.com/interceptors#call-handler).

### Pre-phase short-circuit

The "skip the handler" pattern has two shapes:

- **Return a fresh `Observable`** (e.g. `of(cached)`) instead of `next.handle()` → the handler never runs, the post-phase operators don't run either (you're returning a different stream).
- **Throw in the pre phase** → the error skips `next.handle()` and falls through to [[nestjs/fundamentals/exception-filters|exception filters]]. `catchError` chained on `next.handle()` does **not** see it (the error never reached the stream). To recover from a pre-phase throw, wrap the pre logic in `try/catch` or use `defer(() => …).pipe(catchError(…))`.

## Why an interceptor, not [[nestjs/fundamentals/middleware|middleware]] / [[nestjs/fundamentals/pipes|a pipe]] / [[nestjs/fundamentals/exception-filters|a filter]]

Interceptors are the **sandwich**: bread (pre-phase) → filling (the handler) → bread (post-phase). They're the only layer that wraps both sides of the handler with logic that can also see the return value. The other three each cover one slice:

- [[nestjs/fundamentals/middleware|Middleware]] runs **before** the rest of the pipeline, has no `ExecutionContext`, and can't read the response. Good for raw-request mutation, useless for response shaping or timing.
- [[nestjs/fundamentals/pipes|Pipes]] transform a single argument **before** the handler. They can't see the response and don't run on the way out.
- [[nestjs/fundamentals/exception-filters|Exception filters]] only run on a thrown error. Mapping the **success** value or timing the handler is not their job.

If the work has a "before AND after" shape, or it operates on the handler's return value, it belongs in an interceptor.

## `ExecutionContext` essentials

Same `ExecutionContext` that [[nestjs/fundamentals/guards|guards]] use. The methods you'll actually call:

| Method           | Returns                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getHandler()`   | The handler `Function` about to run: key for `Reflector` metadata lookup                                                                                                                                                                                                                                                                                                                        |
| `getClass()`     | The controller `Type` (the class, not an instance)                                                                                                                                                                                                                                                                                                                                              |
| `switchToHttp()` | `HttpArgumentsHost` → `getRequest()`, `getResponse()`, `getNext()`                                                                                                                                                                                                                                                                                                                              |
| `switchToRpc()`  | RPC context (microservices)                                                                                                                                                                                                                                                                                                                                                                     |
| `switchToWs()`   | WebSocket context                                                                                                                                                                                                                                                                                                                                                                               |
| `getType()`      | `'http' \| 'rpc' \| 'ws'` (extended to `'graphql'` by `@nestjs/graphql`'s [`GqlContextType`](https://github.com/nestjs/graphql/blob/master/packages/graphql/lib/services/gql-execution-context.ts#L6)): branch on this for cross-transport interceptors. [Source: `ExecutionContextHost.getType()`](https://github.com/nestjs/nest/blob/master/packages/core/helpers/execution-context-host.ts) |

Reading route metadata works exactly like in a guard: inject `Reflector`, call `reflector.getAllAndOverride(decorator, [ctx.getHandler(), ctx.getClass()])`. See [[nestjs/fundamentals/guards#Reflector and custom decorators|Guards > Reflector and custom decorators]] for the full pattern.

## Built-in interceptors

[`@nestjs/common`](https://github.com/nestjs/nest/tree/master/packages/common/serializer) ships `ClassSerializerInterceptor` as the lone built-in; the rest you compose yourself with RxJS.

| Interceptor                  | Package          | Purpose                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ClassSerializerInterceptor` | `@nestjs/common` | Runs `class-transformer`'s `classToPlain` (the legacy alias of `instanceToPlain`, per the deprecated [`classToPlain` export](https://github.com/typestack/class-transformer/blob/develop/src/index.ts#L15-L24)) on the response. Honors `@Exclude()`, `@Expose()`, `@Transform()`, and `groups` set via `@SerializeOptions()`. See [[nestjs/recipes/serialization\|the serialization recipe]] |

> [!example]- Excluding fields from the response
>
> ```typescript
> import {
>   ClassSerializerInterceptor,
>   Controller,
>   Get,
>   Param,
>   UseInterceptors,
> } from "@nestjs/common";
> import { Exclude } from "class-transformer";
>
> export class UserEntity {
>   id: number;
>   email: string;
>   @Exclude() password: string;
>
>   constructor(partial: Partial<UserEntity>) {
>     Object.assign(this, partial);
>   }
> }
>
> @Controller("users")
> @UseInterceptors(ClassSerializerInterceptor)
> export class UsersController {
>   @Get(":id")
>   findOne(@Param("id") id: string): UserEntity {
>     return new UserEntity({ id: +id, email: "a@b.c", password: "secret" });
>   }
> }
> ```
>
> Response body: `{ "id": 1, "email": "a@b.c" }`; `password` is stripped. Full coverage in [[nestjs/recipes/serialization|the serialization recipe]] (groups, `@Expose`, `@Transform`, `excludeAll`).

> [!warning] `ClassSerializerInterceptor` only acts on **class instances**
> Nest's [`ClassSerializerInterceptor`](https://github.com/nestjs/nest/blob/master/packages/common/serializer/class-serializer.interceptor.ts) delegates to `class-transformer`'s `classToPlain` (the legacy alias of `instanceToPlain`). Returning a plain object (`return { id, email, password }`) bypasses it silently: `@Exclude()` decorators do nothing. Always return `new UserEntity({...})` (or array of instances) when you want serialization to fire. Requires the `class-transformer` peer dependency (an npm install contract where the consumer app, not Nest, must install the package).

## Binding

| Scope      | How                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| Global     | `app.useGlobalInterceptors(new LoggingInterceptor())` or the `APP_INTERCEPTOR` provider (preferred: supports DI) |
| Controller | `@UseInterceptors(LoggingInterceptor)` on the class                                                              |
| Route      | `@UseInterceptors(LoggingInterceptor)` on the method                                                             |

Controller- and route-scoped bindings always resolve the interceptor through Nest's DI container (you pass the **class**, not an instance), so they can inject anything the module exposes. The catch is global scope.

> [!warning] Pass the class, not an instance
> `@UseInterceptors(LoggingInterceptor)` is resolved by Nest's DI container so the interceptor's constructor injections are wired up. `@UseInterceptors(new LoggingInterceptor())` skips DI: any injected dependency is `undefined` and the interceptor crashes the first time it touches it. Same trap covered in detail at [[nestjs/fundamentals/guards#Binding|Guards > Binding]].

The global-scope variant of the same DI question: `useGlobalInterceptors(new X())` vs `APP_INTERCEPTOR`: has its own dedicated note: [[nestjs/fundamentals/global-providers|Global pipes, guards, interceptors, and filters via DI]]. See in particular the [[nestjs/fundamentals/global-providers#Worked example: an interceptor that reads config|worked example of an interceptor that reads config]] and the [[nestjs/fundamentals/global-providers#Side-by-side|side-by-side comparison]] of `useGlobalInterceptors` vs `APP_INTERCEPTOR`.

## Order: the FILO trick

The same wrap-around shape applies across multiple interceptors. Nest builds the chain global → controller → route ([`context-creator.ts`](https://github.com/nestjs/nest/blob/master/packages/core/helpers/context-creator.ts) concatenates `getGlobalMetadata()` with controller-level then method-level metadata, used by [`interceptors-context-creator.ts`](https://github.com/nestjs/nest/blob/master/packages/core/interceptors/interceptors-context-creator.ts)) and the consumer composes them as nested `next.handle()` calls, so the post phase unwinds in reverse: [`interceptors-consumer.ts`](https://github.com/nestjs/nest/blob/master/packages/core/interceptors/interceptors-consumer.ts) iterates `i = 0..interceptors.length`, returning a `CallHandler` whose `handle()` calls `nextFn(i+1)`.

- **Inbound** (pre code, before `next.handle()`): global → controller → route.
- **Outbound** (RxJS operators, after the handler emits): route → controller → global. First in, last out.

```text
┌─ Global ────────────────────────────────────┐
│  pre                                        │
│  ┌─ Controller ──────────────────────────┐  │
│  │  pre                                  │  │
│  │  ┌─ Route ────────────────────────┐   │  │
│  │  │  pre                           │   │  │
│  │  │      → handler() emits →       │   │  │
│  │  │  post                          │   │  │
│  │  └────────────────────────────────┘   │  │
│  │  post                                 │  │
│  └───────────────────────────────────────┘  │
│  post                                       │
└─────────────────────────────────────────────┘
```

Each layer wraps the next, so a global logging interceptor sees the **final** response shape after every controller/route interceptor has transformed it.

## RxJS toolbox

The post-phase operators you'll actually reach for. Imports come from `rxjs` or `rxjs/operators`.

| Operator         | Use case                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `tap(fn)`        | Side effects (logs, metrics) without changing the value. See the [async pre-phase recipe](#common-recipes)        |
| `map(fn)`        | Transform the emitted value (e.g., wrap as `{ data }`). See the [wrap-response recipe](#common-recipes)           |
| `catchError(fn)` | Map exceptions thrown by the handler to a different error. See the [map-errors recipe](#common-recipes)           |
| `timeout(ms)`    | Cancel the request after `ms` and emit a `TimeoutError`. See the [per-route timeout recipe](#common-recipes)      |
| `of(value)`      | Build a stream from a constant: used to short-circuit (cache). See the [cache recipe](#common-recipes)            |
| `from(promise)`  | Convert a promise into an observable inside the pre phase                                                         |
| `retry({...})`   | Resubscribe on error with `count`, `delay`, and `resetOnSuccess` options. See the [retry recipe](#common-recipes) |
| `defer(fn)`      | Wrap pre-phase work so its errors land in the stream's `catchError`                                               |

## Common recipes

> [!example]- Wrap every response in `{ data }`
>
> ```typescript
> import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
> import { map, Observable } from "rxjs";
>
> @Injectable()
> export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
>   intercept(_ctx: ExecutionContext, next: CallHandler): Observable<{ data: T }> {
>     return next.handle().pipe(map((data) => ({ data })));
>   }
> }
> ```
>
> Source: [NestJS Interceptors > Response mapping](https://docs.nestjs.com/interceptors#response-mapping).

> [!example]- Map handler exceptions to a generic error
>
> ```typescript
> import {
>   BadGatewayException,
>   CallHandler,
>   ExecutionContext,
>   Injectable,
>   NestInterceptor,
> } from "@nestjs/common";
> import { catchError, throwError } from "rxjs";
>
> @Injectable()
> export class ErrorsInterceptor implements NestInterceptor {
>   intercept(_ctx: ExecutionContext, next: CallHandler) {
>     return next.handle().pipe(catchError((err) => throwError(() => new BadGatewayException())));
>   }
> }
> ```
>
> Runs **before** [[exception-filters|exception filters]] reach the error: the `catchError` operator is on the handler stream itself, so the rethrown `BadGatewayException` is what propagates up to the filter chain (see the official [Exception mapping](https://docs.nestjs.com/interceptors#exception-mapping) section).

> [!example]- Per-route timeout
>
> ```typescript
> import {
>   CallHandler,
>   ExecutionContext,
>   Injectable,
>   NestInterceptor,
>   RequestTimeoutException,
> } from "@nestjs/common";
> import { catchError, throwError, timeout, TimeoutError } from "rxjs";
>
> @Injectable()
> export class TimeoutInterceptor implements NestInterceptor {
>   intercept(_ctx: ExecutionContext, next: CallHandler) {
>     return next.handle().pipe(
>       timeout(5000),
>       catchError((err) =>
>         err instanceof TimeoutError
>           ? throwError(() => new RequestTimeoutException())
>           : throwError(() => err),
>       ),
>     );
>   }
> }
> ```

> [!example]- Cache: skip the handler entirely
>
> ```typescript
> import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
> import { of } from "rxjs";
>
> @Injectable()
> export class CacheInterceptor implements NestInterceptor {
>   private store = new Map<string, unknown>();
>
>   intercept(ctx: ExecutionContext, next: CallHandler) {
>     const key = ctx.switchToHttp().getRequest<{ url: string }>().url;
>     const cached = this.store.get(key);
>     return cached ? of(cached) : next.handle();
>   }
> }
> ```
>
> Returning a fresh `Observable` (here from `of`) means `next.handle()` is **never called** and the handler doesn't run. The `Map` is a stub: swap it for a real cache (`@nestjs/cache-manager`, Redis) in production.

> [!example]- Retry transient handler failures
>
> ```typescript
> import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
> import { Observable, retry } from "rxjs";
>
> @Injectable()
> export class RetryInterceptor implements NestInterceptor {
>   intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
>     return next.handle().pipe(
>       retry({
>         count: 2,
>         delay: 250,
>         resetOnSuccess: true,
>       }),
>     );
>   }
> }
> ```
>
> [`retry`](https://github.com/ReactiveX/rxjs/blob/master/packages/rxjs/src/internal/operators/retry.ts#L35-L45) resubscribes to the source observable on error. Its object overload accepts `count`, `delay`, and `resetOnSuccess` via [`RetryConfig`](https://github.com/ReactiveX/rxjs/blob/master/packages/rxjs/src/internal/operators/retry.ts#L7-L33). Because the source here is `next.handle()`, resubscribing **re-invokes the handler**: [`interceptors-consumer.ts`](https://github.com/nestjs/nest/blob/master/packages/core/interceptors/interceptors-consumer.ts) wraps the handler in `defer(...transformDeferred(next))`, and `defer` re-runs its factory (which calls the handler) on every subscription. Only safe for idempotent operations (GET, deterministic computations). Never wrap mutating endpoints in a blanket retry.

> [!example]- Async pre phase (returning `Promise<Observable>`)
>
> ```typescript
> import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
> import { Observable, tap } from "rxjs";
>
> @Injectable()
> export class AuditInterceptor implements NestInterceptor {
>   async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
>     await this.recordStart(ctx); // async pre work
>     return next.handle().pipe(tap(() => this.recordEnd(ctx)));
>   }
>
>   private async recordStart(_ctx: ExecutionContext) {}
>   private async recordEnd(_ctx: ExecutionContext) {}
> }
> ```
>
> Nest awaits the returned promise before subscribing ([`interceptors-consumer.ts`](https://github.com/nestjs/nest/blob/master/packages/core/interceptors/interceptors-consumer.ts) returns the `intercept()` value through `defer().pipe(mergeAll())`, which flattens a `Promise<Observable>` by awaiting the promise then subscribing the inner observable). The handler is delayed until `recordStart` resolves, so don't `await` slow I/O here unless you mean to add latency to every request. Errors thrown from the awaited code skip `next.handle()` entirely (pre-phase throw: see above).

## Gotchas

> [!warning]- `@Res()` disables response mapping
> If a handler injects `@Res()` and writes to the response directly, RxJS operators on the returned stream **don't run**: Nest's [response controller](https://docs.nestjs.com/controllers#library-specific-approach) detects `@Res()` and skips the standard return-value pipeline. Pass `@Res({ passthrough: true })` to keep the standard pipeline (and therefore your interceptors) while still getting the raw response object for cookies, headers, or streaming.

> [!warning]- Calling `next.handle()` more than once runs the handler more than once
> Each call to `next.handle()` returns a fresh cold `Observable`; subscribing twice subscribes the handler twice. The naïve "try cache then fall back" pattern is the usual offender:
>
> ```typescript
> // BUG: handler runs even on cache hit
> intercept(ctx: ExecutionContext, next: CallHandler) {
>   return next.handle().pipe(
>     tap(() => this.maybeStore(ctx)),
>     // someone else later adds: catchError(() => next.handle()) ← second subscription
>   )
> }
> ```
>
> Rule: invoke `next.handle()` exactly **once** per request. To replay a value, capture it with `tap` or `shareReplay`, don't re-subscribe. To short-circuit, return a different observable (`of(x)`) instead of calling `next.handle()` at all.

> [!info]- Cross-transport interceptors must branch on `ctx.getType()`
> The same interceptor class can be applied to HTTP, microservice, WebSocket, and GraphQL handlers. The request shape and "response" semantics differ in each context: `switchToHttp().getResponse()` is meaningless in RPC, and the return value of an RPC handler doesn't become an HTTP body. Branch explicitly:
>
> ```typescript
> if (ctx.getType() === "http") {
>   const res = ctx.switchToHttp().getResponse();
>   // …HTTP-only logic
> }
> ```
>
> See [[nestjs/fundamentals/guards#Cross-transport guards: branch on ctx.getType()|Guards > Cross-transport]] for the full pattern.

> [!info]- Pre-phase errors don't reach `catchError(next.handle())`
> The pipeline `next.handle().pipe(catchError(...))` only catches errors **emitted by the handler stream**. An error thrown synchronously before `next.handle()` is invoked is a regular thrown exception: it bypasses RxJS entirely and lands in [[nestjs/fundamentals/exception-filters|exception filters]]. Use `try/catch` in the pre phase, or wrap the pre work in `defer(() => …)`.

## Common errors

| Symptom                                            | Likely cause                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Response transform doesn't apply                   | Handler uses `@Res()` without `{ passthrough: true }`, so Nest never sees the return value                                      |
| `@Exclude()` fields appear in the response         | Handler returned a plain object, not a class instance: `ClassSerializerInterceptor` only acts on instances                      |
| Global interceptor can't inject                    | Registered via `useGlobalInterceptors(new X())` instead of `APP_INTERCEPTOR` provider                                           |
| `catchError` doesn't fire                          | Error thrown in **pre** phase (before `next.handle()`); only `next.handle().pipe(catchError(…))` catches handler errors         |
| Handler runs twice                                 | `next.handle()` called more than once (often `catchError(() => next.handle())` retry attempt): use the `retry` operator instead |
| Logger fires twice for one request                 | Same interceptor bound at multiple scopes (e.g., globally **and** at controller level)                                          |
| Outbound order surprises                           | Outbound is **FILO**: route post runs first, global post runs last. Don't bind the same interceptor at two scopes               |
| `tap` runs on subscribe but value is missing       | Stream is hot/multi-subscribed elsewhere: use `share()` or rethink the pipeline                                                 |
| `cannot read property of undefined` in interceptor | `switchToHttp()` called in non-HTTP context: branch on `ctx.getType()` for cross-transport interceptors                         |

## When to reach for it

- Logging, metrics, distributed tracing.
- Response shape transforms (wrap every response in `{ data, meta }`).
- Caching, retries, timeouts.
- Mapping infrastructure errors to HTTP exceptions before [[exception-filters|filters]] see them.

## When not to

- Mutating the raw request, attaching correlation IDs **before** auth runs: use [[nestjs/fundamentals/middleware|middleware]] (interceptors run **after** guards in the [request lifecycle](https://docs.nestjs.com/faq/request-lifecycle)).
- Authorization decisions: use [[nestjs/fundamentals/guards|a guard]]. Throwing from an interceptor works but loses the declarative role/permission shape.
- Validating or coercing a single handler argument: use [[nestjs/fundamentals/pipes|a pipe]].
- Catching every thrown exception across the app to shape the error response: that's an [[nestjs/fundamentals/exception-filters|exception filter]]. Interceptors can map errors with `catchError`, but only for the handler stream.

## See also

- [[request-lifecycle|Request lifecycle hub]]
- [[nestjs/observability/logging-pino|Structured logging (planned)]]
- [[nestjs/observability/opentelemetry|OpenTelemetry (planned)]]
