---
title: Middleware
tags:
  - nestjs
  - lifecycle
  - middleware
---

> Functions called **before** the route handler. They have access to the raw request and response objects and call `next()` to pass control. Same idea as Express middleware.

## Signature

```typescript
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    next();
  }
}
```

## Binding

| Scope | How |
|---|---|
| Global | `app.use(fn)` in `main.ts` |
| Module bound | `configure(consumer)` in a module, with path matchers |

## Order

Sequential, in bind order. Global middleware runs first. Across modules, the root module runs first, then by `imports` array order.

## When to reach for it

- Mutate the raw request (parse cookies, attach correlation IDs).
- Adapt third party Express or Fastify middleware.
- Run before any DI-aware component is invoked.

## When not to

- Auth checks: use a [[guards|Guard]] instead. Guards have full DI access and reflection metadata.
- Transformation tied to a specific route param: use a [[pipes|Pipe]].

## See also

- [[request-lifecycle|Request lifecycle hub]]
- [[../auth/guards-vs-middleware|Guards vs middleware]]
