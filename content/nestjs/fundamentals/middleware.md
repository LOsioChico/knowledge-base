---
title: Middleware
aliases: [express middleware, NestMiddleware, MiddlewareConsumer]
tags: [type/concept, lifecycle, tech/http]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/fundamentals/global-providers]]"
  - "[[nestjs/recipes/trace-id]]"
  - "[[nestjs/auth/jwt-strategy]]"
  - "[[nestjs/data/caching]]"
  - "[[nestjs/releases/v10]]"
  - "[[nestjs/releases/v11]]"
source:
  - https://docs.nestjs.com/middleware
  - https://docs.nestjs.com/faq/request-lifecycle
  - https://docs.nestjs.com/security/helmet
  - https://docs.nestjs.com/security/cors
  - https://docs.nestjs.com/techniques/compression
  - https://docs.nestjs.com/techniques/cookies
  - https://docs.nestjs.com/techniques/session
  - https://docs.nestjs.com/faq/raw-body
  - https://docs.nestjs.com/faq/hybrid-application
  - https://docs.nestjs.com/cli/usages
  - https://github.com/pillarjs/path-to-regexp#parameters
  - https://github.com/pillarjs/path-to-regexp#wildcard
  - https://expressjs.com/en/5x/api.html#path-route-matching
  - https://github.com/expressjs/cors
  - https://github.com/fastify/fastify-cors
  - https://github.com/expressjs/compression
  - https://github.com/nestjs/nest/blob/master/packages/common/interfaces/middleware/middleware-config-proxy.interface.ts
  - https://github.com/nestjs/docs.nestjs.com/blob/master/content/migration.md
---

> Express-style functions called **before** [[nestjs/fundamentals/guards|guards]], [[nestjs/fundamentals/interceptors|interceptors]], [[nestjs/fundamentals/pipes|pipes]], and the route handler. They receive raw `req`/`res` objects and either call `next()` or end the response.

## Signature

```typescript
import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    next();
  }
}
```

The `use()` method can be sync, return a `Promise`, or end the response. **Never** silently return without calling `next()` or ending `res`: the request hangs until the client times out.

## Generate with the CLI

```bash
nest generate middleware logger      # full form
nest g mi logger                     # short alias → src/logger/logger.middleware.ts
nest g mi logger --flat              # no wrapping folder → src/logger.middleware.ts
nest g mi http/request-id            # nested path → src/http/request-id/request-id.middleware.ts
nest g mi http/request-id --flat     # nested + flat → src/http/request-id.middleware.ts
nest g mi logger --no-spec           # skip the *.spec.ts test file
nest g mi logger --dry-run           # preview the file plan, write nothing
```

Same shape as the other pipeline-component generators (`gu`, `pi`, `itc`). The CLI defaults to wrapping the file in a folder named after the element; `--flat` drops it directly in the target. Source: [Nest CLI usages](https://docs.nestjs.com/cli/usages).

## Functional middleware

Class middleware can inject providers from the same module. If the middleware needs no dependencies, a plain function is shorter and the [official docs note this is the right shape for that case](https://docs.nestjs.com/middleware#functional-middleware):

```typescript
import { NextFunction, Request, Response } from "express";

export function logger(req: Request, res: Response, next: NextFunction): void {
  next();
}
```

Functional middleware is bound the same way as class middleware: pass the function reference to `consumer.apply(...)` or `app.use(...)`.

## Why middleware, not a [[nestjs/fundamentals/guards|guard]] or [[nestjs/fundamentals/interceptors|interceptor]]

Middleware runs first in the [[nestjs/fundamentals/request-lifecycle|request pipeline]] and sees only raw HTTP. It has **no `ExecutionContext`**: it cannot read decorator metadata, the controller class, or the handler reference. That makes it the right tool for cross-cutting HTTP concerns (helmet, compression, request IDs) and the wrong tool for anything that depends on which handler will run.

| Need                                                                                   | Use                                                         |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Mutate raw `req`/`res` for every (matching) route                                      | Middleware                                                  |
| Decide "should this handler run?" based on roles/permissions                           | [[nestjs/fundamentals/guards\|Guard]]                       |
| Validate or coerce a parameter (`@Body()`, `@Param()`, `@Query()`)                     | [[nestjs/fundamentals/pipes\|Pipe]]                         |
| Wrap the handler (timing, [[nestjs/data/caching\|caching]], response mapping, retries) | [[nestjs/fundamentals/interceptors\|Interceptor]]           |
| Turn a thrown error into an HTTP response                                              | [[nestjs/fundamentals/exception-filters\|Exception filter]] |

## Common middleware you'll plug in

Most apps wire the same handful of Express-ecosystem packages. Nest documents the canonical setup for each:

| Middleware                                                    | Package           | Purpose                                                                                              | Bind via                                                                                      |
| ------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Helmet](https://docs.nestjs.com/security/helmet)             | `helmet`          | Security headers (CSP, HSTS, X-Frame-Options, …)                                                     | `app.use(helmet())` in `main.ts` ([example](#common-recipes))                                 |
| [CORS](https://docs.nestjs.com/security/cors)                 | built-in          | Cross-origin policy                                                                                  | `app.enableCors(options)` ([example](#common-recipes))                                        |
| [Compression](https://docs.nestjs.com/techniques/compression) | `compression`     | gzip/deflate/brotli response compression ([README](https://github.com/expressjs/compression#readme)) | `app.use(compression())` in `main.ts` ([example](#common-recipes))                            |
| `cookie-parser`                                               | `cookie-parser`   | Parse `Cookie` header into `req.cookies`                                                             | `app.use(cookieParser())` ([Nest cookies docs](https://docs.nestjs.com/techniques/cookies))   |
| `express-session`                                             | `express-session` | Server-side session store                                                                            | `app.use(session(options))` ([Nest session docs](https://docs.nestjs.com/techniques/session)) |
| [Body parsers](#body-parsers-raw-vs-json)                     | built-in          | `express.json()` / `express.urlencoded()` (auto on)                                                  | Toggle with `NestFactory.create(AppModule, { bodyParser: false })`                            |

CORS is the odd one: it has a dedicated `enableCors()` instead of `app.use(cors())`. The Express adapter wraps the [`cors`](https://github.com/expressjs/cors) package; the Fastify adapter wraps [`@fastify/cors`](https://github.com/fastify/fastify-cors). Use the helper so the same options object works on both adapters ([Nest CORS docs](https://docs.nestjs.com/security/cors)).

## Binding

| Scope        | How                                                         | DI access |
| ------------ | ----------------------------------------------------------- | --------- |
| Global       | `app.use(fn)` in `main.ts`                                  | No        |
| Module bound | `consumer.apply(LoggerMiddleware).forRoutes(...)`           | Yes       |
| All routes   | Module-bound class middleware with `.forRoutes('{*splat}')` | Yes       |

> [!warning] Wildcard syntax changed since [[nestjs/releases/v11|v11]]
> Express v5 is the default in NestJS 11 ([migration guide → Express v5](https://github.com/nestjs/docs.nestjs.com/blob/master/content/migration.md#express-v5)) and requires **named** wildcards. Use `'{*splat}'` to match every path including the bare base, or `'*splat'` to match anything below the base. Pre-v11 patterns like `'*'`, `'(.*)'`, and `'users/*'` still work via Nest's compatibility layer but emit warnings; the migration is mechanical. Same fix applies to `@Get('*')` and `RouterModule` paths.

There is no middleware slot in `@Module()` metadata. Module-bound middleware lives in `configure()` on a class that implements `NestModule`:

```typescript
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { CatsController } from "./cats.controller";
import { LoggerMiddleware } from "./logger.middleware";

@Module({ controllers: [CatsController] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LoggerMiddleware)
      .exclude({ path: "cats/health", method: RequestMethod.GET })
      .forRoutes(CatsController);
  }
}
```

Middleware has **no `APP_*` token** like [[nestjs/fundamentals/global-providers|pipes, guards, interceptors, and filters]]. The DI-aware path is `MiddlewareConsumer`; `app.use()` always bypasses the container.

### `MiddlewareConsumer`

| Method           | Use                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `apply(...)`     | Attach one or more class or function middleware. Multiple entries run sequentially.           |
| `exclude(...)`   | Skip paths before the final matcher. Accepts strings and `{ path, method }` route objects.    |
| `forRoutes(...)` | Finish the chain by matching strings, route objects, controller classes, or multiple entries. |

You can call `.apply(A, B, C)` to chain several middleware in one go; they run in the order passed.

## Order

Middleware runs **before** every other pipeline layer. Inside the middleware tier:

1. Global middleware bound via `app.use(...)` in `main.ts` (in bind order).
2. Module-bound middleware from the root module's `configure()` (in `apply()` order).
3. Module-bound middleware from imported modules, in `imports` array order.

> [!warning] Global modules jump the queue (NestJS 11+)
> Middleware registered inside a module marked `@Global()` runs **first** among module-bound middleware regardless of where the module sits in the dependency graph ([migration guide → Middleware registration order](https://github.com/nestjs/docs.nestjs.com/blob/master/content/migration.md#middleware-registration-order)). Order within a single global module still follows `apply()` order; order across global modules follows discovery order.

After the middleware chain finishes, Nest moves on to [[nestjs/fundamentals/guards|guards]] → [[nestjs/fundamentals/interceptors|interceptors]] (pre) → [[nestjs/fundamentals/pipes|pipes]] → handler. Source: [Request lifecycle](https://docs.nestjs.com/faq/request-lifecycle).

If a middleware does not end the response, it must call `next()`. Otherwise the request stays open.

## Route matching

| Pattern            | Matches                                                     | Notes                                                                    |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| `'cats'`           | exact path                                                  | Plain string                                                             |
| `'cats/:id'`       | `cats/1`, `cats/abc` (not `cats`, not `cats/a/b`)           | Named **parameter**. Matches **exactly one** segment (delimiter is `/`). |
| `'cats/*splat'`    | `cats/1`, `cats/abc`, `cats/a/b`, `cats/a/b/c` (not `cats`) | Named **wildcard**. Matches **one or more** segments, greedy across `/`. |
| `'cats/{*splat}'`  | `cats` and any subpath (`cats/1`, `cats/a/b`, ...)          | Braces make the wildcard optional → **zero or more** segments.           |
| `{ path, method }` | path + HTTP method                                          | Use `RequestMethod.GET`, `POST`, etc.                                    |
| `CatsController`   | every route declared by the controller                      | Pass the class, not an instance                                          |

The parameter / wildcard distinction is the one that bites: `:id` stops at the next `/`, `*splat` swallows everything to the end of the path. `splat` and `id` are just parameter names: pick any identifier. Patterns use the path-to-regexp syntax that ships with Express v5; pre-v11 forms like `'cats/*'` still work via Nest's compatibility layer but emit a startup warning. Source: [path-to-regexp - Parameters & Wildcard](https://github.com/pillarjs/path-to-regexp#parameters), [Middleware - Route wildcards](https://docs.nestjs.com/middleware#route-wildcards).

`exclude()` must come **before** `forRoutes()` because `forRoutes()` returns `MiddlewareConsumer` (no further `exclude()`/`forRoutes()` on the chain), while `exclude()` returns `MiddlewareConfigProxy` ([interface](https://github.com/nestjs/nest/blob/master/packages/common/interfaces/middleware/middleware-config-proxy.interface.ts)).

## Common recipes

> [!example]- Attach a [[nestjs/recipes/trace-id|request id]] to every response
>
> Functional middleware, no DI needed. Read the inbound `x-request-id` if the caller sent one, otherwise mint a new one. Echoed back on the response so callers can correlate.
>
> ```typescript
> // request-id.middleware.ts
> import { randomUUID } from "node:crypto";
> import { NextFunction, Request, Response } from "express";
>
> export function requestId(req: Request, res: Response, next: NextFunction): void {
>   const id = (req.headers["x-request-id"] as string) ?? randomUUID();
>   req.headers["x-request-id"] = id;
>   res.setHeader("x-request-id", id);
>   next();
> }
> ```
>
> ```typescript
> // main.ts
> import { NestFactory } from "@nestjs/core";
> import { AppModule } from "./app.module";
> import { requestId } from "./request-id.middleware";
>
> async function bootstrap() {
>   const app = await NestFactory.create(AppModule);
>   app.use(requestId);
>   await app.listen(3000);
> }
> bootstrap();
> ```
>
> For a request-scoped logger that picks this up via `AsyncLocalStorage`, see the [[nestjs/recipes/trace-id|trace-id recipe]].

> [!example]- Access log middleware (status, URL, duration)
>
> Apache/nginx-style access logs belong in middleware: the line `GET /cats 200 4ms` describes what the **HTTP layer** did. Middleware sees every request, including 404s, requests rejected by guards, and requests that blew up in pipes: an [[nestjs/fundamentals/interceptors|interceptor]] can't log those because the handler never ran ([request lifecycle](https://docs.nestjs.com/faq/request-lifecycle) places middleware ahead of guards/pipes/handler).
>
> Rule of thumb:
>
> | Question                                                                          | Where it belongs                                                    |
> | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
> | "What did the **HTTP layer** do?" (method, URL, status, bytes)                    | Middleware (access log)                                             |
> | "What did **my code** do?" (which handler ran, what it returned, business events) | [[nestjs/fundamentals/interceptors\|Interceptor]] (application log) |
>
> Production apps usually have both. The class form is shown here so DI is available when you need it later (e.g. `constructor(private config: ConfigService) {}`); the snippet itself doesn't inject anything yet.
>
> ```typescript
> // logger.middleware.ts
> import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
> import { NextFunction, Request, Response } from "express";
>
> @Injectable()
> export class HttpLoggerMiddleware implements NestMiddleware {
>   private readonly logger = new Logger("HTTP");
>
>   use(req: Request, res: Response, next: NextFunction): void {
>     const started = Date.now();
>     res.on("finish", () => {
>       this.logger.log(
>         `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`,
>       );
>     });
>     next();
>   }
> }
> ```
>
> ```typescript
> // app.module.ts
> import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
> import { HttpLoggerMiddleware } from "./logger.middleware";
>
> @Module({})
> export class AppModule implements NestModule {
>   configure(consumer: MiddlewareConsumer): void {
>     consumer.apply(HttpLoggerMiddleware).forRoutes("{*splat}");
>   }
> }
> ```
>
> Listening on `res.on('finish', ...)` is the canonical way to time the full request: it fires after interceptors, pipes, the handler, and the outgoing response have all completed.

### Body parsers: raw vs json

A body parser is a piece of middleware that **reads the request stream once** and stores the result on `req.body`. The choice of parser decides what shape your handler sees. Nest's Express adapter auto-registers `express.json()` and `express.urlencoded()`; the others you bind yourself.

| Parser                 | Matches `Content-Type`                      | `req.body` becomes                 | When to use                                                                                                                                        |
| ---------------------- | ------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `express.json()`       | `application/json`                          | Parsed JS object (`{ amount: 1 }`) | 99% of REST endpoints. Auto-on under Nest.                                                                                                         |
| `express.urlencoded()` | `application/x-www-form-urlencoded`         | Object from form fields            | HTML form posts. Auto-on under Nest.                                                                                                               |
| `express.raw()`        | Any (configurable, e.g. `application/json`) | `Buffer` of the original bytes     | Webhooks where a third party signs the byte-for-byte payload (Stripe, GitHub), or binary uploads. See the [Stripe webhook recipe](#common-recipes) |
| `express.text()`       | `text/plain` (configurable)                 | UTF-8 `string`                     | Plain-text payloads, XML you'll parse yourself                                                                                                     |

The request body is a one-shot stream: once a parser has consumed it, no other parser can. That's why mixing them on overlapping paths breaks: whichever runs first wins, and downstream code sees `req.body` already in that shape (or an empty `{}` if the type didn't match).

Why `raw` matters for signed webhooks: signature verification recomputes an HMAC over the **exact bytes** the sender hashed. Stripe spells this out (the [verify webhook signatures manually docs](https://docs.stripe.com/webhooks/signature#verify-manually) require "the raw request body, exactly as Stripe sent it"); GitHub does too ([securing webhooks](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries#about-validating-webhook-deliveries)). `JSON.stringify(req.body)` round-trips through the JS object representation and won't reproduce the original bytes, so re-serializing fails the check. `express.raw()` keeps the original `Buffer` so you can verify, then `JSON.parse(req.body.toString())` yourself.

> [!example]- Capture the raw body for a Stripe webhook
>
> Stripe signs the **raw** request body. The default `express.json()` parser replaces it with a parsed object before your handler runs. Disable Nest's built-in body parser, then route raw bodies to the webhook path only:
>
> ```typescript
> // main.ts
> import { json, raw } from "express";
> import { NestFactory } from "@nestjs/core";
> import { AppModule } from "./app.module";
>
> async function bootstrap() {
>   const app = await NestFactory.create(AppModule, { bodyParser: false });
>   app.use("/webhooks/stripe", raw({ type: "application/json" }));
>   app.use(json()); // re-enable JSON parsing for everything else
>   await app.listen(3000);
> }
> bootstrap();
> ```
>
> An alternative is `NestFactory.create(AppModule, { rawBody: true })` plus `@Req() req: RawBodyRequest<Request>` and `req.rawBody`. See [Raw body](https://docs.nestjs.com/faq/raw-body).

> [!example]- Mount third-party Express middleware globally
>
> Helmet and compression illustrate the standard pattern: install, import, `app.use()` in `main.ts`. They have no Nest-specific wrapper.
>
> ```typescript
> // main.ts
> import compression from "compression";
> import helmet from "helmet";
> import { NestFactory } from "@nestjs/core";
> import { AppModule } from "./app.module";
>
> async function bootstrap() {
>   const app = await NestFactory.create(AppModule);
>   app.use(helmet());
>   app.use(compression());
>   app.enableCors({ origin: "https://example.com" });
>   await app.listen(3000);
> }
> bootstrap();
> ```
>
> CORS uses `app.enableCors(...)` instead of `app.use(cors())` so the platform adapter installs the headers consistently across Express and Fastify ([Nest CORS docs](https://docs.nestjs.com/security/cors)). `app.use(cors())` works on Express only.

## When to reach for it

- Mutate the raw request before Nest reaches guards, pipes, or controllers.
- Attach correlation IDs, request IDs, or low-level logging context.
- Plug in a third-party Express middleware (helmet, compression, cookie-parser, …).
- Apply cross-cutting HTTP behavior that is not tied to handler metadata.

## When not to

- Authorization: use a [[nestjs/fundamentals/guards|guard]]. Guards read route metadata and decide whether the handler should run.
- DTO checks or param coercion: use a [[nestjs/fundamentals/pipes|pipe]]. Pipes run with argument metadata.
- Response mapping, caching, or timing **around** the handler: use an [[nestjs/fundamentals/interceptors|interceptor]].
- Catching exceptions and shaping the error response: use an [[nestjs/fundamentals/exception-filters|exception filter]].

## Gotchas

> [!warning]- `app.use()` loses DI
> Global middleware bound through `app.use()` cannot resolve providers from the Nest container. Bind class middleware via `MiddlewareConsumer.apply(...).forRoutes(...)` when the middleware needs injected services. Unlike pipes/guards/interceptors, there is no `APP_MIDDLEWARE` token, so [[nestjs/fundamentals/global-providers|the DI-aware-globals shortcut]] doesn't apply here.

> [!warning]- Default body parsers run before custom middleware
> With the Express adapter, Nest registers `express.json()` and `express.urlencoded()` automatically (the [Raw body FAQ](https://docs.nestjs.com/faq/raw-body) shows the opt-out). To customize parsing (raw bodies for webhooks, multipart, custom limits), pass `{ bodyParser: false }` to `NestFactory.create()` first, then bind your parser.

> [!warning]- Middleware does not run on microservices or WebSocket gateways
> `app.use()` and `MiddlewareConsumer` live on `INestApplication` (the HTTP layer). Microservice transports and WebSocket gateways have no middleware concept; use guards, interceptors, or pipes there. In a [hybrid app](https://docs.nestjs.com/faq/hybrid-application), `inheritAppConfig: true` shares pipes/interceptors/guards/filters with `connectMicroservice()` but does not exist for middleware.

> [!info]- No `ExecutionContext` in middleware
> Middleware sees raw HTTP objects, not `ExecutionContext`. If the logic needs handler metadata, the controller class, or the handler reference, it belongs in a guard or interceptor.

> [!info]- Fastify adapter changes the `req`/`res` types
> Under `@nestjs/platform-fastify`, the parameters are `FastifyRequest` and `FastifyReply` (and `done` instead of `next` for Fastify hooks). Class middleware via `MiddlewareConsumer` still works, but the request/response shape and any third-party middleware you plug in must be Fastify-compatible.

## Common errors

| Symptom                                | Likely cause                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| Request hangs                          | Middleware did not call `next()` and did not end the response                           |
| Injected provider is `undefined`       | Bound through `app.use()` instead of `MiddlewareConsumer`                               |
| Custom body parser ignored             | Forgot `{ bodyParser: false }` on `NestFactory.create()`                                |
| Middleware runs on excluded route      | `exclude()` placed after `forRoutes()` (the chain closes on `forRoutes`)                |
| Cannot read handler metadata           | Wrong layer: use a guard or interceptor, middleware has no `ExecutionContext`           |
| Middleware never fires on a WS gateway | Middleware is HTTP-only. Move the logic to a guard or interceptor                       |
| Stripe webhook signature fails         | `express.json()` consumed the body before your handler. Use `raw()` on the webhook path |

## See also

- [[nestjs/fundamentals/request-lifecycle|Request lifecycle hub]]
- [[nestjs/fundamentals/guards|Guards]]: authorization, runs after middleware.
- [[nestjs/fundamentals/interceptors|Interceptors]]: wrap the handler with timing, caching, response mapping.
- [[nestjs/fundamentals/global-providers|Global pipes, guards, interceptors, and filters via DI]]: middleware doesn't have an `APP_*` token, but the rest of the pipeline does.
- [[nestjs/recipes/trace-id|Trace-id recipe]]: pair a request-id middleware with `AsyncLocalStorage` for log correlation.
- Official docs: [Middleware](https://docs.nestjs.com/middleware), [Helmet](https://docs.nestjs.com/security/helmet), [CORS](https://docs.nestjs.com/security/cors), [Compression](https://docs.nestjs.com/techniques/compression).
