---
title: Exception Filters
aliases:
  [
    error handler,
    http exception filter,
    HttpException,
    BaseExceptionFilter,
    APP_FILTER,
  ]
tags: [type/concept, lifecycle, errors]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/global-providers]]"
  - "[[nestjs/recipes/validation]]"
  - "[[nestjs/recipes/trace-id]]"
  - "[[nestjs/recipes/rate-limiting]]"
  - "[[nestjs/auth/jwt-strategy]]"
  - "[[nestjs/data/typeorm/handle-database-errors]]"
source:
  - https://docs.nestjs.com/exception-filters
  - https://docs.nestjs.com/fundamentals/execution-context
  - https://docs.nestjs.com/faq/http-adapter
  - https://docs.nestjs.com/cli/usages
---

> Catch unhandled exceptions and turn them into HTTP responses. Think of filters as the **last-chance handler**: every other lifecycle component is a forward checkpoint that runs in order; a filter runs *only* when something blew up somewhere upstream ([[nestjs/fundamentals/middleware|middleware]], [[nestjs/fundamentals/guards|guards]], [[nestjs/fundamentals/interceptors|interceptors]], [[nestjs/fundamentals/pipes|pipes]], the handler, or the response interceptor chain).
>
> Two things make filters unique: (1) bindings resolve **bottom-up** (route → controller → global, the opposite of every other layer), and (2) only the most specific filter wins — once it catches the exception, no other filter sees it. The most specific gets first dibs; the global filter is the safety net underneath.

## What runs by default

Nest ships a built-in global filter that handles every uncaught exception. Behavior:

- `HttpException` (and subclasses) → use the exception's status and message.
- Anything else → `500 Internal Server Error` with body `{ "statusCode": 500, "message": "Internal server error" }`.
- Errors that look like [`http-errors`](https://www.npmjs.com/package/http-errors) (have `statusCode` + `message`) get those values respected instead of falling back to 500.

You only need to write a filter when you want to **change the response shape**, **map domain errors to HTTP codes**, **log/forward the error somewhere** (Sentry, DataDog), or **handle non-HTTP transports**.

## Signature

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common"
import { Request, Response } from "express"

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter<HttpException> {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const status = exception.getStatus()

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message,
    })
  }
}
```

`@Catch(HttpException)` registers the filter for `HttpException` and any subclass. Pass a comma-separated list (`@Catch(HttpException, RpcException)`) for several types, or no argument (`@Catch()`) for **catch-all**.

## Generate with the CLI

```bash
nest generate filter http-exception      # full form
nest g f http-exception                  # short alias → src/http-exception/http-exception.filter.ts
nest g f http-exception --flat           # no wrapping folder → src/http-exception.filter.ts
nest g f errors/all-exceptions           # nested path → src/errors/all-exceptions/all-exceptions.filter.ts
nest g f errors/all-exceptions --flat    # nested + flat → src/errors/all-exceptions.filter.ts
nest g f http-exception --no-spec        # skip the *.spec.ts test file
nest g f http-exception --dry-run        # preview the file plan, write nothing
```

The schematic emits an empty `@Catch()` filter (catch-all) by default. Source: [Nest CLI usages](https://docs.nestjs.com/cli/usages).

## Built-in HTTP exceptions

All extend `HttpException` and live in `@nestjs/common`. Throw them anywhere and the default global filter responds with the right status:

| Status | Class                            | Worked example |
| -----: | -------------------------------- | -------------- |
|    400 | `BadRequestException`            | [[nestjs/recipes/validation#Customizing the error response\|Customizing the validation error response]] |
|    401 | `UnauthorizedException`          | [[nestjs/auth/jwt-strategy\|JWT auth strategy]] |
|    402 | `PaymentRequiredException`       | |
|    403 | `ForbiddenException`             | [[nestjs/fundamentals/guards#Common recipes\|Custom guard exception]] |
|    404 | `NotFoundException`              | |
|    405 | `MethodNotAllowedException`      | |
|    406 | `NotAcceptableException`         | |
|    408 | `RequestTimeoutException`        | [[nestjs/fundamentals/interceptors#Common recipes\|Timeout interceptor]] |
|    409 | `ConflictException`              | [[nestjs/data/typeorm/handle-database-errors#Recipe 1 Centralize in an exception filter recommended for NestJS\|DB unique-violation filter]] |
|    410 | `GoneException`                  | |
|    412 | `PreconditionFailedException`    | |
|    413 | `PayloadTooLargeException`       | |
|    415 | `UnsupportedMediaTypeException`  | |
|    418 | `ImATeapotException`             | |
|    422 | `UnprocessableEntityException`   | [[nestjs/data/typeorm/handle-database-errors#Recipe 1 Centralize in an exception filter recommended for NestJS\|DB constraint-violation filter]] |
|    500 | `InternalServerErrorException`   | |
|    501 | `NotImplementedException`        | |
|    502 | `BadGatewayException`            | |
|    503 | `ServiceUnavailableException`    | |
|    504 | `GatewayTimeoutException`        | |
|    505 | `HttpVersionNotSupportedException` | |

All accept `(message?, options?)` where `options = { cause?, description? }`. With a description:

```typescript
throw new BadRequestException("Something bad happened", {
  cause: new Error("upstream timeout"),
  description: "Some error description",
})
// → { "message": "Something bad happened", "error": "Some error description", "statusCode": 400 }
```

`cause` is **not** serialized into the response; use it for log/Sentry context.

## `HttpException` constructor

```typescript
new HttpException(response: string | Record<string, any>, status: number, options?: HttpExceptionOptions)
```

- `string` response → body is `{ statusCode, message: <string> }`.
- `object` response → that object **replaces** the body verbatim.
- `options.cause` → preserved as `Error.cause`, useful for chained logging.

## `ArgumentsHost` essentials

`ArgumentsHost` is the parent type of [[nestjs/fundamentals/guards|`ExecutionContext`]]. It does **not** expose `getHandler()` / `getClass()` (you don't usually need handler metadata at the error layer):

| Method           | Returns                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `switchToHttp()` | `HttpArgumentsHost` → `getRequest()`, `getResponse()`, `getNext()` |
| `switchToRpc()`  | RPC context (microservices)                                        |
| `switchToWs()`   | WebSocket context                                                  |
| `getType()`      | `'http' \| 'rpc' \| 'ws'` (or `'graphql'` with `@nestjs/graphql`)  |
| `getArgs()`      | Raw arguments tuple for the current handler                        |

For platform-agnostic filters that work across both Express and Fastify, prefer the [`HttpAdapterHost` recipe](#common-recipes) over reaching for `Response` directly.

## Binding

| Scope      | How                                                                                 |
| ---------- | ----------------------------------------------------------------------------------- |
| Global     | `app.useGlobalFilters(new X())` or the [[nestjs/fundamentals/global-providers\|`APP_FILTER` provider]] |
| Controller | `@UseFilters(X)` or `@UseFilters(new X())` on the class                             |
| Route      | `@UseFilters(X)` on the method                                                      |

> [!warning] Pass the class, not an instance
> `@UseFilters(HttpExceptionFilter)` is resolved by Nest's DI container so the filter's constructor and field injections are wired up. `@UseFilters(new HttpExceptionFilter())` skips DI: any injected dependency is `undefined`. For a filter extending `BaseExceptionFilter`, the symptom is the "no http adapter" crash documented in [common errors](#common-errors) below — both `applicationRef` (constructor arg) and `httpAdapterHost` (`@Optional() @Inject()` field) end up undefined. Same trap covered in detail at [[nestjs/fundamentals/guards#Binding|Guards > Binding]].

The global-scope variant of the same DI question — `useGlobalFilters(new X())` vs `APP_FILTER` — has its own dedicated note: [[nestjs/fundamentals/global-providers|Global pipes, guards, interceptors, and filters via DI]]. It covers the side-by-side comparison, request-scope and hybrid-app implications, and when to reach for `useClass` vs `useFactory`.

```typescript
import { Controller, Get, UseFilters } from "@nestjs/common"
import { HttpExceptionFilter } from "./http-exception.filter"

@UseFilters(HttpExceptionFilter)
@Controller("cats")
export class CatsController {
  @Get()
  list() {}
}
```

## Order: route first, then controller, then global

Filters resolve **bottom-up**, the opposite of every other lifecycle component:

1. Route-bound filter
2. Controller-bound filter
3. Global filter

Once a filter catches the exception, **no other filter sees it**. To layer behavior (e.g., always log, then format), use class inheritance from `BaseExceptionFilter`, not stacking. This is the opposite of [[nestjs/fundamentals/pipes|pipes]], [[nestjs/fundamentals/guards|guards]], and [[nestjs/fundamentals/interceptors|interceptors]], where every applicable instance runs.

## When `@Catch()` is empty (catch-all)

```typescript
@Catch()
export class CatchEverythingFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void { /* … */ }
}
```

> [!warning]- Order matters when mixing catch-all with typed filters
> When `@UseFilters(CatchEverything, HttpExceptionFilter)` lists the catch-all first, the typed filter still wins for `HttpException` because Nest matches each filter's `@Catch(...)` against the exception type. Reverse the order and the catch-all silently swallows everything before the typed filter is checked. Declare the broadest filter first. Source: [Catch everything](https://docs.nestjs.com/exception-filters#catch-everything).

## Common recipes

> [!example]- Map a domain error to an HTTP status
>
> Service code throws a domain-level error; the filter translates it into the right HTTP status without leaking implementation details to the controller.
>
> ```typescript
> // user-not-found.error.ts
> export class UserNotFoundError extends Error {
>   constructor(public readonly id: string) {
>     super(`User ${id} not found`)
>   }
> }
> ```
>
> ```typescript
> // user-not-found.filter.ts
> import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common"
> import { Response } from "express"
> import { UserNotFoundError } from "./user-not-found.error"
>
> @Catch(UserNotFoundError)
> export class UserNotFoundFilter implements ExceptionFilter<UserNotFoundError> {
>   catch(exception: UserNotFoundError, host: ArgumentsHost): void {
>     const response = host.switchToHttp().getResponse<Response>()
>     response.status(HttpStatus.NOT_FOUND).json({
>       error: "USER_NOT_FOUND",
>       userId: exception.id,
>     })
>   }
> }
> ```
>
> The controller stays clean: `throw new UserNotFoundError(id)`. The filter owns the HTTP shape. Bind globally via `APP_FILTER`.

> [!example]- Platform-agnostic catch-all via `HttpAdapterHost`
>
> Works under both `@nestjs/platform-express` and `@nestjs/platform-fastify` because it talks to the abstract HTTP adapter rather than `Response.json()` / `Response.send()` directly:
>
> ```typescript
> // all-exceptions.filter.ts
> import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common"
> import { HttpAdapterHost } from "@nestjs/core"
>
> @Catch()
> export class AllExceptionsFilter implements ExceptionFilter {
>   constructor(private readonly httpAdapterHost: HttpAdapterHost) {}
>
>   catch(exception: unknown, host: ArgumentsHost): void {
>     const { httpAdapter } = this.httpAdapterHost
>     const ctx = host.switchToHttp()
>     const status =
>       exception instanceof HttpException
>         ? exception.getStatus()
>         : HttpStatus.INTERNAL_SERVER_ERROR
>
>     httpAdapter.reply(
>       ctx.getResponse(),
>       {
>         statusCode: status,
>         timestamp: new Date().toISOString(),
>         path: httpAdapter.getRequestUrl(ctx.getRequest()),
>       },
>       status,
>     )
>   }
> }
> ```
>
> ```typescript
> // app.module.ts
> import { Module } from "@nestjs/common"
> import { APP_FILTER } from "@nestjs/core"
> import { AllExceptionsFilter } from "./all-exceptions.filter"
>
> @Module({
>   providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
> })
> export class AppModule {}
> ```
>
> `HttpAdapterHost` is only available after `NestFactory.create()` finishes wiring the adapter, which is why the official docs resolve it inside `catch()` rather than caching `httpAdapter` in the constructor. See [HTTP adapter](https://docs.nestjs.com/faq/http-adapter).

> [!example]- Extend `BaseExceptionFilter` to add logging without losing default behavior
>
> When you only want to *augment* Nest's built-in filter (e.g., always log unknown exceptions, then let Nest produce its standard 500 response), extend `BaseExceptionFilter` and call `super.catch()`:
>
> ```typescript
> // logging-exception.filter.ts
> import { ArgumentsHost, Catch, Logger } from "@nestjs/common"
> import { BaseExceptionFilter } from "@nestjs/core"
>
> @Catch()
> export class LoggingExceptionFilter extends BaseExceptionFilter {
>   private readonly logger = new Logger("UnhandledException")
>
>   catch(exception: unknown, host: ArgumentsHost): void {
>     this.logger.error(exception instanceof Error ? exception.stack : exception)
>     super.catch(exception, host)
>   }
> }
> ```
>
> Register via `APP_FILTER`. Do **not** instantiate `BaseExceptionFilter`-extended filters with `new` at controller/method scope: the framework needs to inject the `HttpAdapter` reference for `super.catch()` to work.

> [!example]- Forward to Sentry, then re-respond
>
> Capture the original error, attach context, then delegate to the default response shape:
>
> ```typescript
> // sentry.filter.ts
> import { ArgumentsHost, Catch, HttpException } from "@nestjs/common"
> import { BaseExceptionFilter } from "@nestjs/core"
> import * as Sentry from "@sentry/node"
>
> @Catch()
> export class SentryFilter extends BaseExceptionFilter {
>   catch(exception: unknown, host: ArgumentsHost): void {
>     // Don't ship 4xx noise to Sentry; track 5xx and unknown errors.
>     const isClientError = exception instanceof HttpException && exception.getStatus() < 500
>     if (!isClientError) {
>       Sentry.captureException(exception)
>     }
>     super.catch(exception, host)
>   }
> }
> ```

## Pairs with `ValidationPipe`

The [[nestjs/recipes/validation|ValidationPipe]] throws `BadRequestException`, which the default global filter renders as:

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

Override the response shape by passing `exceptionFactory` to `ValidationPipe` (preferred, keeps the filter chain simple) **or** by writing a `BadRequestException` filter that reformats the body. Stick with `exceptionFactory` unless you also want to reshape errors thrown elsewhere.

## When to reach for it

- Standardize the error response shape across the API (`{ error, code, requestId, … }`).
- Map domain errors (`UserNotFoundError`, `InsufficientStockError`) to HTTP statuses without leaking them to controllers.
- Forward errors to a tracker (Sentry, DataDog) before responding.
- Add `requestId` / [[nestjs/recipes/trace-id|trace id]] to every error body for log correlation.

## When not to

- Validation/coercion: that's a [[nestjs/fundamentals/pipes|pipe]]'s job. Pipes throw, the filter renders.
- Authorization decisions: a [[nestjs/fundamentals/guards|guard]] should reject **before** any handler work.
- Wrapping the handler with timing/caching/retry: that's an [[nestjs/fundamentals/interceptors|interceptor]].
- Mutating the raw request: [[nestjs/fundamentals/middleware|middleware]].

## Gotchas

> [!warning]- `useGlobalFilters()` skips microservice/WebSocket gateways in hybrid apps
> Same trap, same fix as the other lifecycle components. Use `APP_FILTER` or pass `{ inheritAppConfig: true }` to `connectMicroservice`. Full explanation in [[nestjs/fundamentals/global-providers#Hybrid apps gotcha|Global providers > Hybrid apps gotcha]].

> [!info]- Filter caught the exception → no further filter runs
> Filters do **not** chain. Once a filter's `catch()` returns (or sends the response), no other filter sees the exception. To compose behaviors (log + reshape), inherit from `BaseExceptionFilter` and call `super.catch()` instead of binding two separate filters. Source: [`exceptions-handler.ts`](https://github.com/nestjs/nest/blob/master/packages/core/exceptions/exceptions-handler.ts) (`invokeCustomFilters` selects one filter and returns).

> [!warning]- `BaseExceptionFilter` subclasses cannot be `new`'d at controller/route scope
> They depend on the `HttpAdapter` injected by Nest. Use `@UseFilters(MyFilter)` (the **class**, not an instance) or register globally via `APP_FILTER`. Source: [Inheritance](https://docs.nestjs.com/exception-filters#inheritance).

> [!info]- Built-in HTTP exceptions are not logged by default
> `HttpException` (and `WsException`, `RpcException`) extend `IntrinsicException`. Nest's built-in filter treats them as part of normal flow and skips logging. If you want every error in the console, write a filter that logs and then delegates (`super.catch()` or your own response code).

> [!info]- Fastify uses `response.send()`, not `response.json()`
> Under `@nestjs/platform-fastify`, the response shape is `FastifyReply`. Either swap `.json(body)` for `.send(body)` (and import `FastifyReply` from `fastify`), or use the [`HttpAdapterHost` recipe](#common-recipes) which works on both adapters.

> [!info]- A `try/catch` inside the handler swallows the exception
> Filters only see **uncaught** exceptions. If a controller wraps a service call in `try/catch` and converts the error into a response itself, no filter runs. That's fine when the controller wants the local error shape; bring the throw back if you want the filter chain to handle it.

## Common errors

| Symptom                                                                    | Likely cause                                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Every error becomes `500 Internal server error`                            | The thrown error is not an `HttpException` and no custom filter handles it                  |
| Custom filter runs but the response is empty / hangs                       | Forgot `response.status(...).json(...)` (or `.send(...)` on Fastify)                        |
| `Cannot read properties of undefined` inside `catch()`                     | Called `host.switchToHttp()` in a non-HTTP context. Branch on `host.getType()` first        |
| `BaseExceptionFilter`-extended filter throws "no http adapter"             | Bound with `new MyFilter()` at method scope. Use the class form or `APP_FILTER`             |
| Catch-all filter eats `HttpException` even though a typed filter is bound  | `@UseFilters(...)` listed the typed filter **before** the catch-all. Reverse the order      |
| Filter doesn't fire for a microservice or WebSocket handler                | Bound via `useGlobalFilters()` in a hybrid app. Switch to `APP_FILTER`                      |
| Validation errors come out as `{ statusCode, message, error }` (array)    | That's the default. Customize via `ValidationPipe({ exceptionFactory })` in [[nestjs/recipes/validation\|the validation recipe]] |
| Sentry sees thousands of `400`s a day                                      | Catch-all forwards every exception. Filter on `HttpException && getStatus() < 500` first    |

## See also

- [[nestjs/fundamentals/request-lifecycle|Request lifecycle hub]]
- [[nestjs/fundamentals/global-providers|Global pipes, guards, interceptors, and filters via DI]]: `APP_FILTER` is the DI-aware way to register a global filter.
- [[nestjs/recipes/validation|Validation recipe]]: customize the body of validation errors via `exceptionFactory`.
- [[nestjs/recipes/trace-id|Trace-id recipe]]: pair an `AsyncLocalStorage`-backed request id with a filter that adds it to every error response.
- Official docs: [Exception filters](https://docs.nestjs.com/exception-filters), [Execution context](https://docs.nestjs.com/fundamentals/execution-context), [HTTP adapter](https://docs.nestjs.com/faq/http-adapter).
