---
title: Interceptors
aliases: [aspect, around-handler]
tags: [type/concept, lifecycle, tech/rxjs]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/recipes/serialization]]"
  - "[[nestjs/recipes/file-uploads]]"
source:
  - https://docs.nestjs.com/interceptors
  - https://github.com/nestjs/nest/tree/master/packages/common/serializer
  - https://rxjs.dev/api/operators
---

> Wrap the route handler with logic that runs **before and after** it. A single AOP "around" advice — built on RxJS, so the response stream is fair game.

## Signature

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common"
import { Observable, tap } from "rxjs"

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log("Before...") // pre
    const start = Date.now()
    return next.handle().pipe(
      tap(() => console.log(`After ${Date.now() - start}ms`)), // post
    )
  }
}
```

`NestInterceptor<T, R>` is generic: `T` is the type emitted by the handler (`Observable<T>`) and `R` is what your interceptor emits downstream (`Observable<R>`). Both methods can be `async`.

## The pre/post pattern

> [!info] One method, two halves
> `intercept(context, next)` runs **once per request**. Code before `next.handle()` is the **pre** phase; RxJS operators piped onto the returned `Observable` are the **post** phase. NestJS calls this the AOP "Pointcut" pattern — the handler invocation is the pointcut, your interceptor wraps it.

```text
intercept(ctx, next) {
  // ── PRE  ─────────────── runs before the handler
  return next.handle().pipe(
    // ── POST ───────────── runs after the handler emits
  );
}
```

If you **never call** `next.handle()`, the handler is skipped — useful for caching (see recipes below). Source: [NestJS Interceptors > Call handler](https://docs.nestjs.com/interceptors#call-handler).

## Built-in interceptors

Nest ships only one out of the box; the rest you compose yourself with RxJS.

| Interceptor                  | Package          | Purpose                                                                                                                                                    |
| ---------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ClassSerializerInterceptor` | `@nestjs/common` | Runs `class-transformer`'s `instanceToPlain` on the response. Honors `@Exclude()`, `@Expose()`, `@Transform()`, and `groups` set via `@SerializeOptions()` |

> [!example]- Excluding fields from the response
>
> ```typescript
> import {
>   ClassSerializerInterceptor,
>   Controller,
>   Get,
>   Param,
>   UseInterceptors,
> } from "@nestjs/common"
> import { Exclude } from "class-transformer"
>
> export class UserEntity {
>   id: number
>   email: string
>   @Exclude() password: string
>
>   constructor(partial: Partial<UserEntity>) {
>     Object.assign(this, partial)
>   }
> }
>
> @Controller("users")
> @UseInterceptors(ClassSerializerInterceptor)
> export class UsersController {
>   @Get(":id")
>   findOne(@Param("id") id: string): UserEntity {
>     return new UserEntity({ id: +id, email: "a@b.c", password: "secret" })
>   }
> }
> ```
>
> Response body: `{ "id": 1, "email": "a@b.c" }` — `password` is stripped. The interceptor only acts on **class instances**; returning a plain object (`{ id, email, password }`) bypasses it. Verified in [`class-serializer.interceptor.ts`](https://github.com/nestjs/nest/blob/master/packages/common/serializer/class-serializer.interceptor.ts). Requires the `class-transformer` peer dep. Full coverage in [[nestjs/recipes/serialization|the serialization recipe]] (groups, `@Expose`, `@Transform`, `excludeAll`).

## Binding

| Scope      | How                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| Global     | `app.useGlobalInterceptors(new LoggingInterceptor())` or the `APP_INTERCEPTOR` provider (preferred — supports DI) |
| Controller | `@UseInterceptors(LoggingInterceptor)` on the class                                                               |
| Route      | `@UseInterceptors(LoggingInterceptor)` on the method                                                              |

Controller- and route-scoped bindings always resolve the interceptor through Nest's DI container (you pass the **class**, not an instance), so they can inject anything the module exposes. The catch is global scope.

> [!tip]- DI for global interceptors — what changes with vs. without
> Say your interceptor needs to read a flag from `ConfigService`:
>
> ```typescript
> import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common"
> import { ConfigService } from "@nestjs/config"
>
> @Injectable()
> export class AuditInterceptor implements NestInterceptor {
>   constructor(private readonly config: ConfigService) {}
>
>   intercept(ctx: ExecutionContext, next: CallHandler) {
>     if (!this.config.get<boolean>("AUDIT_ENABLED")) return next.handle()
>     // …log to your audit sink
>     return next.handle()
>   }
> }
> ```
>
> **Without DI** — `main.ts`:
>
> ```typescript
> app.useGlobalInterceptors(new AuditInterceptor(/* ??? */))
> ```
>
> You're calling `new` yourself, so Nest never wires `ConfigService`. `this.config` is `undefined` → runtime crash. Same goes for `Logger`, repositories, HTTP clients, anything provided by a module.
>
> **With DI** — register as a provider in any module (commonly `AppModule`):
>
> ```typescript
> import { Module } from "@nestjs/common"
> import { APP_INTERCEPTOR } from "@nestjs/core"
>
> @Module({
>   providers: [
>     { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }, // AuditInterceptor from the class above
>   ],
> })
> export class AppModule {}
> ```
>
> Nest instantiates `AuditInterceptor` through the container, resolves `ConfigService` from its constructor, and applies it globally. Rule of thumb: if the interceptor has **any** constructor dependency, use `APP_INTERCEPTOR`. Source: [Binding interceptors](https://docs.nestjs.com/interceptors#binding-interceptors).

## Order: the FILO trick

The same wrap-around shape applies across multiple interceptors.

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

| Operator         | Use case                                                       |
| ---------------- | -------------------------------------------------------------- |
| `tap(fn)`        | Side effects (logs, metrics) without changing the value        |
| `map(fn)`        | Transform the emitted value (e.g., wrap as `{ data }`)         |
| `catchError(fn)` | Map exceptions thrown by the handler to a different error      |
| `timeout(ms)`    | Cancel the request after `ms` and emit a `TimeoutError`        |
| `of(value)`      | Build a stream from a constant — used to short-circuit (cache) |
| `from(promise)`  | Convert a promise into an observable inside the pre phase      |

> [!warning] `@Res()` disables response mapping
> If a handler injects `@Res()` and writes to the response directly, RxJS operators on the returned stream **don't run**. Use `@Res({ passthrough: true })` if you need both raw access and interceptors.

## Common recipes

> [!example]- Wrap every response in `{ data }`
>
> ```typescript
> import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common"
> import { map, Observable } from "rxjs"
>
> @Injectable()
> export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
>   intercept(_ctx: ExecutionContext, next: CallHandler): Observable<{ data: T }> {
>     return next.handle().pipe(map((data) => ({ data })))
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
> } from "@nestjs/common"
> import { catchError, throwError } from "rxjs"
>
> @Injectable()
> export class ErrorsInterceptor implements NestInterceptor {
>   intercept(_ctx: ExecutionContext, next: CallHandler) {
>     return next.handle().pipe(catchError((err) => throwError(() => new BadGatewayException())))
>   }
> }
> ```
>
> Runs **before** [[exception-filters|exception filters]] — the filter sees the rethrown `BadGatewayException`, not the original.

> [!example]- Per-route timeout
>
> ```typescript
> import {
>   CallHandler,
>   ExecutionContext,
>   Injectable,
>   NestInterceptor,
>   RequestTimeoutException,
> } from "@nestjs/common"
> import { catchError, throwError, timeout, TimeoutError } from "rxjs"
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
>     )
>   }
> }
> ```

> [!example]- Cache: skip the handler entirely
>
> ```typescript
> import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common"
> import { of } from "rxjs"
>
> @Injectable()
> export class CacheInterceptor implements NestInterceptor {
>   private store = new Map<string, unknown>()
>
>   intercept(ctx: ExecutionContext, next: CallHandler) {
>     const key = ctx.switchToHttp().getRequest<{ url: string }>().url
>     const cached = this.store.get(key)
>     return cached ? of(cached) : next.handle()
>   }
> }
> ```
>
> Returning a fresh `Observable` (here from `of`) means `next.handle()` is **never called** and the handler doesn't run. The `Map` is a stub — swap it for a real cache (`@nestjs/cache-manager`, Redis) in production.

## Common errors

| Symptom                                      | Likely cause                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Response transform doesn't apply             | Handler uses `@Res()` without `{ passthrough: true }`, so Nest never sees the return value                              |
| Global interceptor can't inject              | Registered via `useGlobalInterceptors(new X())` instead of `APP_INTERCEPTOR` provider                                   |
| `catchError` doesn't fire                    | Error thrown in **pre** phase (before `next.handle()`); only `next.handle().pipe(catchError(…))` catches handler errors |
| Logger fires twice for one request           | Same interceptor bound at multiple scopes (e.g., globally **and** at controller level)                                  |
| `tap` runs on subscribe but value is missing | Stream is hot/multi-subscribed elsewhere — use `share()` or rethink the pipeline                                        |

## When to reach for it

- Logging, metrics, distributed tracing.
- Response shape transforms (wrap every response in `{ data, meta }`).
- Caching, retries, timeouts.
- Mapping infrastructure errors to HTTP exceptions before [[exception-filters|filters]] see them.

## See also

- [[request-lifecycle|Request lifecycle hub]]
- [[nestjs/observability/logging-pino|Structured logging (planned)]]
- [[nestjs/observability/opentelemetry|OpenTelemetry (planned)]]
