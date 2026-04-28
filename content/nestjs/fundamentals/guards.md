---
title: Guards
aliases: [authorization guard, canActivate, roles guard]
tags: [type/concept, lifecycle]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/recipes/trace-id]]"
  - "[[nestjs/recipes/validation]]"
  - "[[nestjs/fundamentals/global-providers]]"
source:
  - https://docs.nestjs.com/guards
  - https://docs.nestjs.com/fundamentals/execution-context
  - https://github.com/nestjs/nest/tree/master/packages/core/guards
---

> Decide whether a request reaches the route handler. Used for **authorization**: roles, permissions, ownership, anything that should short-circuit before the handler runs.

## Signature

```typescript
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Request } from "express"
import { Observable } from "rxjs"

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    return Boolean(request.headers.authorization)
  }
}
```

`canActivate` returns:

- `true` → continue to the next layer ([[nestjs/fundamentals/interceptors|interceptors]] then [[nestjs/fundamentals/pipes|pipes]] then handler).
- `false` → Nest throws `ForbiddenException` (`403 Forbidden`).
- A thrown exception → caught by [[nestjs/fundamentals/exception-filters|exception filters]], same as anywhere else.

It can return synchronously, as a `Promise`, or as an RxJS `Observable`.

## Generate with the CLI

```bash
nest generate guard roles      # full form
nest g gu roles                # short alias → src/roles/roles.guard.ts
nest g gu roles --flat         # no wrapping folder → src/roles.guard.ts
nest g gu auth/jwt             # nested path → src/auth/jwt/jwt.guard.ts
nest g gu auth/jwt --flat      # nested + flat → src/auth/jwt.guard.ts
nest g gu roles --no-spec      # skip the *.spec.ts test file
nest g gu roles --dry-run      # preview the file plan, write nothing
```

Creates `<name>.guard.ts` (and `<name>.guard.spec.ts` unless `--no-spec`). The `nest` CLI wraps the file in a folder named after the element by default; pass `--flat` to drop it directly in the target path. Source: [`@nestjs/cli` generate command](https://github.com/nestjs/nest-cli/blob/master/commands/generate.command.ts), [Nest CLI usages](https://docs.nestjs.com/cli/usages).

## Why a guard, not [[nestjs/fundamentals/middleware|middleware]]

Both run before the handler, but middleware is "dumb": it doesn't know which handler will execute next. A guard receives an `ExecutionContext` and can read **route metadata** (`@Roles()`, `@Public()`, etc.) plus the controller class and handler reference. That is what makes role/permission decisions declarative. See [Guards intro](https://docs.nestjs.com/guards).

## Built-in guards

Nest core ships **none**. Authorization is application-specific, so you write your own — or pull one from a peer package.

| Guard                 | Package             | Purpose                                                                                                                                                                 |
| --------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthGuard(strategy)` | `@nestjs/passport`  | Bridge to a [Passport](https://docs.nestjs.com/recipes/passport) strategy (`'jwt'`, `'local'`, `'oauth2'`, …). See the [`IS_PUBLIC` recipe below](#common-recipes) and [[nestjs/auth/jwt-strategy\|JWT strategy (planned)]] |
| `ThrottlerGuard`      | `@nestjs/throttler` | Rate limiting per route or controller                                                                                                                                   |

Anything else you write yourself. The canonical example is a `RolesGuard` — covered below.

> [!todo]- Clarify Passport / strategy / `@nestjs/passport` layering in `jwt-strategy` note
> Open the planned note with the four-layer split: Passport (orchestrator) → strategy package (`passport-jwt`, `passport-local`, …) → `@nestjs/passport` wrapper (`PassportStrategy`, `AuthGuard`) → user code (`JwtStrategy`, `JwtAuthGuard`). `AuthGuard('jwt')` does not "do JWT" — it delegates to whatever strategy is registered under that name. This is the #1 source of confusion in NestJS auth.

## `ExecutionContext` essentials

`ExecutionContext` extends `ArgumentsHost` and adds two methods that make guards reusable across handlers.

| Method           | Returns                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| `getHandler()`   | The handler `Function` about to run (e.g. `CatsController.prototype.create`) |
| `getClass()`     | The controller `Type` (`CatsController`, not an instance)                    |
| `switchToHttp()` | `HttpArgumentsHost` → `getRequest()`, `getResponse()`, `getNext()`           |
| `switchToRpc()`  | RPC context (microservices)                                                  |
| `switchToWs()`   | WebSocket context                                                            |
| `getType()`      | `'http' \| 'rpc' \| 'ws'` (or `'graphql'` with `@nestjs/graphql`)            |

`getHandler()` and `getClass()` are the keys that `Reflector` uses to read decorator metadata. Source: [Execution context](https://docs.nestjs.com/fundamentals/execution-context).

## Binding

| Scope      | How                                                                            | DI access     |
| ---------- | ------------------------------------------------------------------------------ | ------------- |
| Global     | `app.useGlobalGuards(new AuthGuard())` or the `APP_GUARD` provider (preferred) | Provider only |
| Controller | `@UseGuards(AuthGuard)` on the class                                           | Yes           |
| Route      | `@UseGuards(AuthGuard)` on the method                                          | Yes           |

Controller- and route-scoped bindings always resolve through Nest's DI container when you pass the **class** (`@UseGuards(RolesGuard)`). Pass an instance (`@UseGuards(new RolesGuard())`) and DI is bypassed.

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common"
import { RolesGuard } from "./roles.guard"

@UseGuards(RolesGuard)
@Controller("cats")
export class CatsController {
  @Get()
  list() {}
}
```

> [!tip]- DI for global guards — what changes with vs. without
> Say your guard needs `Reflector` plus an injected `UsersService`:
>
> ```typescript
> import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
> import { Reflector } from "@nestjs/core"
> import { UsersService } from "./users.service"
>
> @Injectable()
> export class RolesGuard implements CanActivate {
>   constructor(
>     private readonly reflector: Reflector,
>     private readonly users: UsersService,
>   ) {}
>
>   canActivate(ctx: ExecutionContext): boolean {
>     // …
>     return true
>   }
> }
> ```
>
> **Without DI** — `main.ts`:
>
> ```typescript
> app.useGlobalGuards(new RolesGuard(/* ??? */))
> ```
>
> You're calling `new` yourself, so Nest never wires `Reflector` or `UsersService`. Both are `undefined` → runtime crash. Same trap applies to any provider.
>
> **With DI** — register through `APP_GUARD`:
>
> ```typescript
> import { Module } from "@nestjs/common"
> import { APP_GUARD } from "@nestjs/core"
> import { RolesGuard } from "./roles.guard"
>
> @Module({
>   providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
> })
> export class AppModule {}
> ```
>
> The guard is global regardless of the module that registers it — pick the module that **defines** the guard and its dependencies. Source: [Binding guards](https://docs.nestjs.com/guards#binding-guards).

## Order

Multiple guards run in this order:

1. Global guards (registration order).
2. Controller guards (left-to-right inside `@UseGuards()`).
3. Route guards (left-to-right inside `@UseGuards()`).

The chain stops at the **first** guard that returns `false`, throws, or rejects a returned `Promise` — later guards do not run.

```typescript
import { Controller, Get, UseGuards } from "@nestjs/common"

@UseGuards(Guard1, Guard2)
@Controller("cats")
export class CatsController {
  @UseGuards(Guard3)
  @Get()
  list() {}
}
// Execution: Guard1 → Guard2 → Guard3 (then interceptors/pipes/handler)
```

In the [[nestjs/fundamentals/request-lifecycle|request lifecycle]], **all** guards run after middleware and before any [[nestjs/fundamentals/interceptors|interceptor]] or [[nestjs/fundamentals/pipes|pipe]].

## Reflector and custom decorators

The point of a guard is to make per-route decisions, which means reading per-route metadata. `Reflector` (from `@nestjs/core`) is the bridge.

### Strongly-typed decorators with `Reflector.createDecorator`

```typescript
// roles.decorator.ts
import { Reflector } from "@nestjs/core"

export const Roles = Reflector.createDecorator<string[]>()
```

```typescript
// cats.controller.ts
import { Body, Controller, Post } from "@nestjs/common"
import { Roles } from "./roles.decorator"
import { CreateCatDto } from "./create-cat.dto"

@Controller("cats")
export class CatsController {
  @Post()
  @Roles(["admin"])
  create(@Body() dto: CreateCatDto) {}
}
```

```typescript
// roles.guard.ts
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Request } from "express"
import { Roles } from "./roles.decorator"

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride(Roles, [ctx.getHandler(), ctx.getClass()])
    if (!required?.length) return true // no @Roles() → public

    const request = ctx.switchToHttp().getRequest<Request & { user?: { roles: string[] } }>()
    const user = request.user
    return Boolean(user?.roles?.some((r) => required.includes(r)))
  }
}
```

Routes without `@Roles()` are treated as public: `getAllAndOverride` returns `undefined` when no metadata is found at handler or class level, so the guard short-circuits to `true`.

### `Reflector` lookup methods

| Method                       | When to use                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `get(decorator, target)`     | Single target — handler **or** class. Returns `undefined` if absent                                       |
| `getAllAndOverride(d, [..])` | Multiple targets, **first non-empty wins**. Use when route metadata should override controller defaults   |
| `getAllAndMerge(d, [..])`    | Multiple targets, **merge** arrays/objects. Use when you want both controller and route metadata combined |

The target list `[ctx.getHandler(), ctx.getClass()]` is the conventional order: handler first, controller second, so route-level metadata overrides controller-level. Source: [Reflection and metadata](https://docs.nestjs.com/fundamentals/execution-context#reflection-and-metadata).

### Low-level `@SetMetadata`

`Reflector.createDecorator` is the recommended path. `@SetMetadata('roles', [...])` is the older string-keyed alternative — fine for one-off cases, but loses type safety:

```typescript
import { SetMetadata } from "@nestjs/common"

export const Roles = (...roles: string[]) => SetMetadata("roles", roles)
// Read with: this.reflector.get<string[]>("roles", ctx.getHandler())
```

## Common recipes

> [!example]- `IS_PUBLIC` opt-out for a global auth guard
>
> Pattern: register a global `JwtAuthGuard`, then mark public routes with `@Public()` so the guard skips them.
>
> ```typescript
> // public.decorator.ts
> import { SetMetadata } from "@nestjs/common"
> export const IS_PUBLIC_KEY = "isPublic"
> export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
> ```
>
> ```typescript
> // jwt-auth.guard.ts
> import { ExecutionContext, Injectable } from "@nestjs/common"
> import { Reflector } from "@nestjs/core"
> import { AuthGuard } from "@nestjs/passport"
> import { IS_PUBLIC_KEY } from "./public.decorator"
>
> @Injectable()
> export class JwtAuthGuard extends AuthGuard("jwt") {
>   constructor(private readonly reflector: Reflector) {
>     super()
>   }
>
>   canActivate(ctx: ExecutionContext) {
>     const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
>       ctx.getHandler(),
>       ctx.getClass(),
>     ])
>     if (isPublic) return true
>     return super.canActivate(ctx)
>   }
> }
> ```
>
> Register `JwtAuthGuard` via `APP_GUARD` and decorate exempt routes with `@Public()`. Pattern from the official [Authentication recipe](https://docs.nestjs.com/security/authentication#enable-authentication-globally).

> [!example]- Throw a custom exception instead of the default `ForbiddenException`
>
> ```typescript
> import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
>
> @Injectable()
> export class TokenGuard implements CanActivate {
>   canActivate(ctx: ExecutionContext): boolean {
>     const request = ctx.switchToHttp().getRequest()
>     if (!request.headers.authorization) {
>       throw new UnauthorizedException("Missing bearer token")
>     }
>     return true
>   }
> }
> ```
>
> Returning `false` always produces `403`. Throw an explicit exception when the semantically correct status is something else (`401`, `429`, etc.). The thrown error flows through the normal [[nestjs/fundamentals/exception-filters|exception filter]] chain.

> [!example]- Ownership check using route params
>
> ```typescript
> import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common"
>
> @Injectable()
> export class CatOwnerGuard implements CanActivate {
>   async canActivate(ctx: ExecutionContext): Promise<boolean> {
>     const req = ctx.switchToHttp().getRequest()
>     const userId: string | undefined = req.user?.id
>     const catId: string = req.params.id
>     if (!userId) throw new ForbiddenException()
>     // …query DB; return true/false based on ownership
>     return true
>   }
> }
> ```

## Common errors

| Symptom                                              | Likely cause                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `403 Forbidden resource` on every request            | Guard returns `false` (or `undefined` — falsy). Check `canActivate` actually returns `true`                  |
| Global guard's injected provider is `undefined`      | Registered via `useGlobalGuards(new X())` instead of `APP_GUARD` provider                                    |
| `Reflector` returns `undefined` for known decorator  | Looking up the wrong target — used `getHandler()` when the metadata is on the class (`getClass()`)           |
| Controller-level metadata ignored                    | Used `reflector.get(d, ctx.getHandler())` instead of `getAllAndOverride(d, [getHandler(), getClass()])`      |
| Guard runs but `request.user` is `undefined`         | Authentication middleware/guard didn't run first, or no upstream layer attached `user`                       |
| Guard doesn't run for WebSocket/microservice handler | Wrong context — verify with `ctx.getType()` and use `switchToWs()` / `switchToRpc()` for the right transport |
| `cannot read property of undefined` inside guard     | Calling `switchToHttp()` in a non-HTTP context. Branch on `ctx.getType()` for cross-transport guards         |

## Gotchas

> [!warning]- Returning `false` always yields `403`, never `401`
> Nest converts `false` into `ForbiddenException`. If the route is unauthenticated (no token) the correct status is `401 Unauthorized` — throw `new UnauthorizedException()` instead of returning `false`. See the official [putting it all together](https://docs.nestjs.com/guards#putting-it-all-together) note.

> [!warning]- `useGlobalGuards()` skips microservice/WebSocket gateways in hybrid apps
> In a hybrid app (`createHybrid` or `connectMicroservice`), `app.useGlobalGuards()` does **not** apply to gateways or microservices by default. Use the `APP_GUARD` provider, or pass `{ inheritAppConfig: true }` when connecting microservices. Source: [Hybrid application](https://docs.nestjs.com/faq/hybrid-application).

> [!warning]- Guards run **after** middleware
> If your authentication logic lives in middleware, it runs first and can attach `request.user` before the guard reads it. The opposite is impossible: a guard cannot mutate the request in time for middleware. If both layers need shared context, decide which one owns it.

> [!info]- Cross-transport guards: branch on `ctx.getType()`
> The same guard class can run on HTTP, RPC, and WebSocket handlers, but the request shape differs. Use `ctx.getType()` to switch:
>
> ```typescript
> import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common"
>
> @Injectable()
> export class CrossTransportGuard implements CanActivate {
>   canActivate(ctx: ExecutionContext): boolean {
>     switch (ctx.getType()) {
>       case "http":
>         return this.checkHttp(ctx.switchToHttp().getRequest())
>       case "rpc":
>         return this.checkRpc(ctx.switchToRpc().getData())
>       case "ws":
>         return this.checkWs(ctx.switchToWs().getClient())
>       default:
>         return false
>     }
>   }
>
>   private checkHttp(_req: unknown) {
>     return true
>   }
>   private checkRpc(_data: unknown) {
>     return true
>   }
>   private checkWs(_client: unknown) {
>     return true
>   }
> }
> ```

## When to reach for it

- Role, permission, or ACL checks.
- Ownership checks ("can this user touch this resource?").
- Feature flags that should hard-block a route.
- Anything that must short-circuit the request **before** [[nestjs/recipes/validation|validation]], transformation, or DB work.

## When not to

- Mutating the raw request, attaching correlation IDs: use [[nestjs/fundamentals/middleware|middleware]].
- Validating or coercing input shape: use [[nestjs/fundamentals/pipes|a pipe]].
- Logging, caching, or wrapping the handler with timing: use [[nestjs/fundamentals/interceptors|an interceptor]].
- Turning a thrown error into an HTTP response: that's an [[nestjs/fundamentals/exception-filters|exception filter]] — the guard's job ends at "throw".

## See also

- [[nestjs/fundamentals/request-lifecycle|Request lifecycle hub]]
- [[nestjs/auth/jwt-strategy|JWT strategy with Passport (planned)]]
- [[nestjs/auth/guards-vs-middleware|Guards vs middleware (planned)]]
- [[nestjs/auth/rbac-cbac|RBAC and CBAC (planned)]]
