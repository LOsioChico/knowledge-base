---
title: Interceptors
tags:
  - nestjs
  - lifecycle
  - rxjs
---

> Wrap the route handler with logic that runs **before and after** it. Built on RxJS, so they can transform the response stream.

## Signature

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`${Date.now() - start}ms`)),
    );
  }
}
```

## Binding

| Scope | How |
|---|---|
| Global | `app.useGlobalInterceptors()` or the `APP_INTERCEPTOR` provider |
| Controller | `@UseInterceptors()` on the class |
| Route | `@UseInterceptors()` on the method |

## Order: the FILO trick

Inbound (before `next.handle()`): global, controller, route.

Outbound (after the handler returns): the observables resolve **first in, last out**, so the order on the response side is route, controller, global.

A global logging interceptor therefore sees the **final** response shape after all route and controller interceptors have transformed it.

## Errors

Any error thrown by a pipe, controller, or service can be caught with `catchError` inside an interceptor, before it reaches the [[exception-filters|filter]] layer.

## When to reach for it

- Logging, metrics, distributed tracing.
- Response shape transforms (wrap every response in `{ data, meta }`).
- Caching, retries, timeouts.

## See also

- [[request-lifecycle|Request lifecycle hub]]
- [[../observability/logging-pino|Structured logging]]
- [[../observability/opentelemetry|OpenTelemetry]]
