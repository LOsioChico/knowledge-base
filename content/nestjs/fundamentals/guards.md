---
title: Guards
aliases: [authorization guard, canActivate]
tags: [area/nestjs, type/concept, lifecycle]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/fundamentals/interceptors]]"
source:
  - https://docs.nestjs.com/guards
---

> Decide whether a request will reach the route handler. Used for **authorization**.

## Signature

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return true;
  }
}
```

Return `true` to continue. Return `false` to throw `ForbiddenException`.

## Binding

| Scope | How |
|---|---|
| Global | `app.useGlobalGuards()` or the `APP_GUARD` provider |
| Controller | `@UseGuards()` on the class |
| Route | `@UseGuards()` on the method |

## Order

Global, then controller, then route. Within the same scope, in the order listed in the decorator.

```typescript
@UseGuards(Guard1, Guard2)
@Controller('cats')
export class CatsController {
  @UseGuards(Guard3)
  @Get()
  list() {}
}
// Execution order: Guard1, Guard2, Guard3
```

## When to reach for it

- Role checks, permission checks, ownership checks.
- Anything that should short circuit the request before it costs CPU or DB time.

## See also

- [[request-lifecycle|Request lifecycle hub]]
- [[../auth/jwt-strategy|JWT strategy]]
- [[../auth/guards-vs-middleware|Guards vs middleware]]
- [[../auth/rbac-cbac|RBAC and CBAC]]
