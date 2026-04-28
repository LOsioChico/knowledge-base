---
title: Request trace ID propagation
aliases: [correlation id, request id, trace id, x-request-id]
tags: [type/recipe, tech/asynclocalstorage, lifecycle, errors]
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
---

> [!warning] Seed note
> This note is a placeholder. The full version depends on populating [[nestjs/fundamentals/middleware|middleware]], [[nestjs/fundamentals/exception-filters|exception filters]], and [[nestjs/fundamentals/request-lifecycle|the request lifecycle]] with their trace-id surface points first. Until then, this note records the design and the verified primary sources so the work isn't lost.

A trace ID (also called request ID or correlation ID) is a per-request identifier that is set once at the edge of the system and read everywhere downstream: logs, error responses, outbound HTTP calls. It turns "an error happened" into "request `8f2a` failed at this exact step in this exact service".

The mechanism is `AsyncLocalStorage` from `node:async_hooks`: a per-request store that survives `await`, accessible without passing it as a parameter. NestJS has an [official recipe](https://docs.nestjs.com/recipes/async-local-storage) for it; this note will eventually layer the trace-id-specific patterns on top.

## Implementation

A custom [[nestjs/fundamentals/middleware|middleware]] wraps `next()` with `als.run(store, ...)` so the rest of the lifecycle ([[nestjs/fundamentals/guards|guards]] → [[nestjs/fundamentals/interceptors|interceptors]] → [[nestjs/fundamentals/pipes|pipes]] → handler → [[nestjs/fundamentals/exception-filters|exception filters]]) sees the same store. Zero dependencies beyond Node's built-ins.

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

For non-HTTP transports (microservice handlers, BullMQ consumers, websocket gateways, cron jobs), wrap the entry point with the same `traceStorage.run(...)` call: HTTP middleware doesn't run there, but `AsyncLocalStorage` does.

## Surface points (planned, not yet documented)

The reason this note must wait for its dependencies:

- **[[nestjs/fundamentals/middleware|Middleware]]**: the *only* safe place to start the context with `als.run()`. Needs an explicit recipe section — including the existing one-liner ("Attach correlation IDs, request IDs, or low-level logging context") expanded into a worked example.
- **[[nestjs/fundamentals/exception-filters|Exception filters]]**: they run after the handler and outside the controller's try/catch. They MUST read the trace ID from the store (not from the request, which may be partially mutated) and include it in the JSON error body and `Logger.error` call.
- **[[nestjs/fundamentals/request-lifecycle|Request lifecycle]]**: the diagram should annotate where the store is opened (middleware) and that every downstream stage shares it. Currently the lifecycle note's responsibilities table mentions "correlation IDs" without explaining the mechanism.
- **[[nestjs/fundamentals/interceptors|Interceptors]]**: a `LoggingInterceptor` example that prefixes every line with `[traceId]` and times the handler. Also: an axios/`HttpModule` interceptor that propagates `X-Request-ID` to downstream services.
- **Custom logger**: a `ConsoleLogger` subclass that injects the trace ID into every log line, so application code never has to think about it.

These will land as concrete code blocks in the respective fundamentals notes; this recipe will then become the integration guide that links them together.

## Verified gotchas

- **Use `run()`, not `enterWith()`.** The [Node docs](https://nodejs.org/api/async_context.html#asynclocalstorageenterwithstore) call out `enterWith` as continuing for the entire synchronous execution and recommend `run()` unless there's a strong reason. With `enterWith()`, subsequent requests on the same event-loop turn can see the previous request's context until they hit their own `enterWith()` call. `run()` scopes the store to its callback and unwinds cleanly.
- **`REQUEST`-scoped providers are not a substitute.** They don't work in passport strategies, gateways, or scheduled tasks, and they recreate the entire DI subtree per request. The motivation for ALS-based context is explicitly to replace them where they fail.
- **Generate IDs with `crypto.randomUUID()`**, not `Math.random()`. Fine for log correlation either way, but if the ID ever becomes a security or de-duplication identifier you want it cryptographically random from day one.
- **Trust inbound `X-Request-ID` only from trusted upstreams.** If the request reaches your service directly from the public internet, prefer minting a fresh ID; accepting client-supplied IDs lets attackers poison your logs or collide IDs deliberately.

## See also

- [NestJS: Async Local Storage recipe](https://docs.nestjs.com/recipes/async-local-storage) — the canonical starting point
- [Node.js: `AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
