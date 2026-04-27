---
title: Middleware
aliases: [express middleware]
tags: [type/concept, lifecycle, tech/http]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/pipes]]"
source:
  - https://docs.nestjs.com/middleware
  - https://docs.nestjs.com/faq/request-lifecycle
  - https://docs.nestjs.com/techniques/performance#middleware
---

> Express-style functions called **before** [[nestjs/fundamentals/guards|guards]], [[nestjs/fundamentals/interceptors|interceptors]], [[nestjs/fundamentals/pipes|pipes]], and the route handler. They receive raw request/response objects and either call `next()` or end the response.

## Signature

```typescript
import { Injectable, NestMiddleware } from "@nestjs/common"
import { Request, Response, NextFunction } from "express"

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    next()
  }
}
```

## Functional middleware

Class middleware can inject providers from the same module. If the middleware does not need dependencies, use a plain function:

```typescript
import { NextFunction, Request, Response } from "express"

export function logger(req: Request, res: Response, next: NextFunction): void {
  next()
}
```

## Binding

| Scope        | How                                                  | DI access |
| ------------ | ---------------------------------------------------- | --------- |
| Global       | `app.use(logger)` in `main.ts`                       | No        |
| Module bound | `consumer.apply(LoggerMiddleware).forRoutes(...)`    | Yes       |
| All routes   | Module-bound class middleware with `.forRoutes("*")` | Yes       |

There is no middleware slot in the `@Module()` metadata. Module-bound middleware lives in `configure()` on a module class:

```typescript
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common"
import { CatsController } from "./cats.controller"
import { LoggerMiddleware } from "./logger.middleware"

@Module({ controllers: [CatsController] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LoggerMiddleware)
      .exclude({ path: "cats/health", method: RequestMethod.GET })
      .forRoutes(CatsController)
  }
}
```

### `MiddlewareConsumer`

| Method           | Use                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `apply(...)`     | Attach one or more class or function middleware. Multiple entries run sequentially.           |
| `exclude(...)`   | Skip paths before the final matcher. Accepts strings and `{ path, method }` route objects.    |
| `forRoutes(...)` | Finish the chain by matching strings, route objects, controller classes, or multiple entries. |

## Order

Middleware runs before the rest of the [[nestjs/fundamentals/request-lifecycle|request lifecycle]]. Global middleware runs first, then module-bound middleware. Within each group, middleware runs in bind order. Across modules, middleware bound to the root module runs first, then middleware from imported modules in `imports` array order.

If a middleware does not end the response, it must call `next()`. Otherwise the request stays open.

## Route matching

| Pattern | Matches | Notes |
| --- | --- | --- |
| `'cats'` | exact path | Plain string |
| `'cats/{*splat}'` | any subpath under `cats` | Named wildcard segment |
| `{ path, method }` | path + HTTP method | Use `RequestMethod.GET`, `POST`, etc. |
| `CatsController` | every route declared by the controller | Pass the class, not an instance |

`exclude()` must come before `forRoutes()` because `forRoutes()` closes the chain.

## When to reach for it

- Mutate the raw request before Nest reaches guards, pipes, or controllers.
- Attach correlation IDs, request IDs, or low-level logging context.
- Adapt third-party Express middleware.
- Apply cross-cutting HTTP behavior that is not tied to handler metadata.

## When not to

- Authorization: use a [[guards|guard]]. Guards can read route metadata and decide whether the handler should run.
- DTO checks or param coercion: use a [[pipes|pipe]]. Pipes run with argument metadata.
- Response mapping, caching around the handler, or timing after the handler returns: use an [[nestjs/fundamentals/interceptors|interceptor]].

## Gotchas

> [!warning]- `app.use()` loses DI
> Global middleware bound through `app.use()` cannot resolve providers from the Nest container. Bind class middleware via `MiddlewareConsumer` (or `configure()`) when the middleware needs injected services.

> [!warning]- Default body parsers run before custom middleware
> With the Express adapter, Nest registers JSON and URL-encoded body parsing by default. To customize parsing in middleware, pass `{ bodyParser: false }` to `NestFactory.create()` first, then bind your parser.

> [!info]- No `ExecutionContext` in middleware
> Middleware sees raw HTTP objects, not `ExecutionContext`. If the logic needs handler metadata or class/handler references, it belongs in a guard or interceptor.

## Common errors

| Symptom | Likely cause |
| --- | --- |
| Request hangs | Middleware did not call `next()` and did not end the response |
| Injected provider is `undefined` | Bound through `app.use()` instead of `MiddlewareConsumer` |
| Custom body parser ignored | Forgot `{ bodyParser: false }` on `NestFactory.create()` |
| Middleware runs on excluded route | `exclude()` placed after `forRoutes()` (the chain closes on `forRoutes`) |
| Cannot read handler metadata | Wrong layer — use a guard or interceptor, middleware has no `ExecutionContext` |

## See also

- [[request-lifecycle|Request lifecycle hub]]
