---
title: Request trace ID propagation
aliases: [correlation id, request id, trace id, x-request-id]
tags: [type/recipe, tech/asynclocalstorage, tech/nestjs-cls, lifecycle, errors]
area: nestjs
status: seed
related:
  - "[[nestjs/recipes/index]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/pipes]]"
source:
  - https://docs.nestjs.com/recipes/async-local-storage
  - https://nodejs.org/api/async_context.html
  - https://papooch.github.io/nestjs-cls/
  - https://papooch.github.io/nestjs-cls/setting-up-cls-context/using-a-middleware
  - https://papooch.github.io/nestjs-cls/considerations/security
  - https://github.com/Papooch/nestjs-cls/blob/main/packages/core/src/lib/cls.options.ts
---

> [!warning] Seed note
> This note is a placeholder. The full version depends on populating [[nestjs/fundamentals/middleware|middleware]], [[nestjs/fundamentals/exception-filters|exception filters]], and [[nestjs/fundamentals/request-lifecycle|the request lifecycle]] with their trace-id surface points first. Until then, this note records the design and the verified primary sources so the work isn't lost.

A trace ID (also called request ID or correlation ID) is a per-request identifier that is set once at the edge of the system and read everywhere downstream: logs, error responses, outbound HTTP calls. It turns "an error happened" into "request `8f2a` failed at this exact step in this exact service".

The mechanism is `AsyncLocalStorage` from `node:async_hooks`: a per-request store that survives `await`, accessible without passing it as a parameter. NestJS has an [official recipe](https://docs.nestjs.com/recipes/async-local-storage) for it; this note will eventually layer the trace-id-specific patterns on top.

## Two implementations

### Plain `AsyncLocalStorage` (no extra deps)

Mirrors the NestJS official recipe. A custom [[nestjs/fundamentals/middleware|middleware]] wraps `next()` with `als.run(store, ...)` so the rest of the lifecycle ([[nestjs/fundamentals/guards|guards]] → [[nestjs/fundamentals/interceptors|interceptors]] → [[nestjs/fundamentals/pipes|pipes]] → handler → [[nestjs/fundamentals/exception-filters|exception filters]]) sees the same store.

```typescript
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const traceStorage = new AsyncLocalStorage<{ traceId: string }>();

// in a NestJS middleware
use(req, res, next) {
  const traceId = (req.headers["x-request-id"] as string) ?? randomUUID();
  res.setHeader("x-request-id", traceId);
  traceStorage.run({ traceId }, () => next());
}
```

Read it anywhere with `traceStorage.getStore()?.traceId`.

### `nestjs-cls` (productized)

`nestjs-cls` is the de facto wrapper. It abstracts the middleware/guard/interceptor mounting, supports non-HTTP transports (microservices, queues), and handles request-id generation natively.

```typescript
ClsModule.forRoot({
  global: true,
  middleware: {
    mount: true,
    generateId: true,
    idGenerator: (req) =>
      (req.headers["x-request-id"] as string) ?? randomUUID(),
  },
});
```

Read with `cls.getId()` (built-in) or `cls.get('any-key')`.

#### What `generateId` and `idGenerator` actually do

Verified in [`cls.options.ts`](https://github.com/Papooch/nestjs-cls/blob/main/packages/core/src/lib/cls.options.ts):

- `generateId: false` (default) means the middleware never produces an ID and `cls.getId()` returns `undefined`. You'd have to set one manually with `cls.setId(...)` in `setup`.
- `generateId: true` makes the middleware call `idGenerator(req)` once per request and stores the result under the built-in CLS_ID slot (the one `cls.getId()` reads).
- `idGenerator?: (req: any) => string | Promise<string>` defaults to `() => Math.random().toString(36).slice(-8)` — short, but **not cryptographically random**.

That signature is the trick: since `idGenerator` already receives `req`, header-or-fallback belongs there, not in `setup`. With the snippet above:

- `X-Request-ID` header present → `cls.getId()` returns the incoming value (you propagated the upstream trace).
- Header absent → `cls.getId()` returns a fresh `randomUUID()`.

You almost never need `setup` for the trace ID itself; reach for `setup` when you also want to stash the user, tenant, or other per-request values alongside it.

## Surface points (planned, not yet documented)

The reason this note must wait for its dependencies:

- **[[nestjs/fundamentals/middleware|Middleware]]**: the *only* safe place to start the context with `als.run()`. Needs an explicit recipe section — including the existing one-liner ("Attach correlation IDs, request IDs, or low-level logging context") expanded into a worked example.
- **[[nestjs/fundamentals/exception-filters|Exception filters]]**: they run after the handler and outside the controller's try/catch. They MUST read the trace ID from the store (not from the request, which may be partially mutated) and include it in the JSON error body and `Logger.error` call.
- **[[nestjs/fundamentals/request-lifecycle|Request lifecycle]]**: the diagram should annotate where the store is opened (middleware) and that every downstream stage shares it. Currently the lifecycle note's responsibilities table mentions "correlation IDs" without explaining the mechanism.
- **[[nestjs/fundamentals/interceptors|Interceptors]]**: a `LoggingInterceptor` example that prefixes every line with `[traceId]` and times the handler. Also: an axios/`HttpModule` interceptor that propagates `X-Request-ID` to downstream services.
- **Custom logger**: a `ConsoleLogger` subclass that injects the trace ID into every log line, so application code never has to think about it.

These will land as concrete code blocks in the respective fundamentals notes; this recipe will then become the integration guide that links them together.

## Verified gotchas

- **`enterWith()` leaks across requests.** `nestjs-cls` warns explicitly: when `ClsGuard` (or `ClsMiddleware` with `useEnterWith: true`) is used, subsequent requests see the previous request's context until they hit the `enterWith()` call themselves. Prefer the default `ClsMiddleware` (uses `run()`) and never use [[nestjs/fundamentals/guards|guards]] for this. See the [security note](https://papooch.github.io/nestjs-cls/considerations/security).
- **The default `idGenerator` is `Math.random().toString(36)`**, NOT cryptographically random. Verified in the [`cls.options.ts` source](https://github.com/Papooch/nestjs-cls/blob/main/packages/core/src/lib/cls.options.ts). Fine for log correlation, NOT fine if the ID becomes a security identifier. Override with `crypto.randomUUID()`.
- **`app.use(new ClsMiddleware({...}))` ignores `ClsModule.forRoot()` middleware options.** Pass settings to the constructor directly. Needed when API versioning or route-prefix middleware interferes with module-level ordering.
- **HTTP-only by default.** Microservice transports, BullMQ consumers, websocket gateways, and cron jobs need `ClsGuard` / `ClsInterceptor` (with the `enterWith` caveat above) or a manual `cls.run(...)` wrapper at the entry point.
- **`REQUEST`-scoped providers are not a substitute.** They don't work in passport strategies, gateways, or scheduled tasks, and they recreate the entire DI subtree per request. The motivation for ALS-based context is explicitly to replace them where they fail.
- **`AsyncLocalStorage.run()` is preferred over `enterWith()`** at the Node level too; the [Node docs](https://nodejs.org/api/async_context.html#asynclocalstorageenterwithstore) call out `enterWith` as continuing for the entire synchronous execution and recommend `run()` unless there's a strong reason.

## See also

- [NestJS: Async Local Storage recipe](https://docs.nestjs.com/recipes/async-local-storage) — the canonical starting point
- [Node.js: `AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [`nestjs-cls` documentation](https://papooch.github.io/nestjs-cls/)
