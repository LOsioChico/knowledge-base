---
title: JWT strategy with Passport
aliases:
  [
    jwt auth,
    passport-jwt,
    JwtAuthGuard,
    JwtStrategy,
    "@nestjs/passport",
    JWT authentication,
    bearer token auth,
  ]
tags: [type/recipe, tech/jwt, gotchas]
area: nestjs
status: evergreen
related:
  - "[[nestjs/auth/index]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/global-providers]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/recipes/validation]]"
  - "[[nestjs/recipes/rate-limiting]]"
source:
  - https://docs.nestjs.com/recipes/passport
  - https://docs.nestjs.com/security/authentication
  - https://github.com/nestjs/jwt
  - https://github.com/nestjs/passport/blob/master/lib/auth.guard.ts
  - https://github.com/mikenicholson/passport-jwt
  - https://github.com/mikenicholson/passport-jwt/blob/master/lib/strategy.js
  - https://github.com/nestjs/nest/blob/master/packages/core/services/reflector.service.ts
  - https://docs.nestjs.com/exception-filters
  - https://github.com/nestjs/passport/blob/master/lib/passport/passport.strategy.ts
---

> Issue a JWT on login, protect routes by validating the token, and let specific routes opt out via `@Public()`. The canonical NestJS auth setup.

## The four-layer stack (this is the #1 source of confusion)

| Layer                   | Package                        | What it does                                                              |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| Orchestrator            | `passport`                     | Maintains the registry of named strategies and runs the verify callback   |
| Strategy implementation | `passport-jwt`                 | Knows how to extract a JWT from a request and verify its signature        |
| Nest wrapper            | `@nestjs/passport`             | Adapts Passport to Nest: `PassportStrategy` base class, `AuthGuard(name)` |
| Your code               | `JwtStrategy` + `JwtAuthGuard` | Subclass `PassportStrategy(Strategy)`; subclass `AuthGuard('jwt')`        |

`AuthGuard('jwt')` does **not** "do JWT": it asks Passport to run whatever strategy is registered under the name `'jwt'`. Your `JwtStrategy` claims that name (it's the default for `passport-jwt`). Swap it for any other strategy and `AuthGuard('jwt')` would invoke that one instead.

`@nestjs/jwt` is a **separate** package: a thin wrapper around [`jsonwebtoken`](https://github.com/auth0/node-jsonwebtoken) used to **sign** tokens at login. The strategy package (`passport-jwt`) handles **verification** at request time. Both must be configured with the same secret.

## Setup

```bash
npm install --save @nestjs/passport passport @nestjs/jwt passport-jwt
npm install --save-dev @types/passport-jwt
```

## Login endpoint

The login flow is plain controller code: validate credentials, sign a JWT, return it. No Passport guard on this route: Passport's job starts on the **next** request.

```typescript
// auth/auth.module.ts
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UsersModule } from "../users/users.module";
import { jwtConstants } from "./constants";

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: "60s" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

```typescript
// auth/auth.service.ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async signIn(username: string, pass: string): Promise<{ access_token: string }> {
    const user = await this.usersService.findOne(username);
    if (user?.password !== pass) {
      throw new UnauthorizedException();
    }
    const payload = { sub: user.userId, username: user.username };
    return { access_token: await this.jwtService.signAsync(payload) };
  }
}
```

```typescript
// auth/auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post("login")
  signIn(@Body() signInDto: { username: string; password: string }) {
    return this.authService.signIn(signInDto.username, signInDto.password);
  }
}
```

Request:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "changeme"}'
```

Response (`200 OK`):

```json
{ "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

Wrong credentials:

```json
{ "statusCode": 401, "message": "Unauthorized" }
```

The `sub` claim follows JWT convention (subject of the token) and is conventionally the user id. The default `expiresIn: '60s'` is intentionally short for the docs example; real apps use minutes for access tokens and pair them with refresh tokens.

## JWT strategy

The strategy tells Passport **how** to extract and verify the token, and what user shape to attach to `request.user`.

```typescript
// auth/jwt.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { jwtConstants } from "./constants";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  async validate(payload: { sub: number; username: string }) {
    return { userId: payload.sub, username: payload.username };
  }
}
```

What each option does:

| Option             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jwtFromRequest`   | Where to read the token. `fromAuthHeaderAsBearerToken()` reads `Authorization: Bearer …`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `ignoreExpiration` | Defaults to `false` per [passport-jwt's options](https://github.com/mikenicholson/passport-jwt#configure-strategy). On expiry, passport-jwt calls `self.fail(jwt_err)` ([strategy.js](https://github.com/mikenicholson/passport-jwt/blob/master/lib/strategy.js)), so `@nestjs/passport`'s default `handleRequest` sees `(err=null, user=false, info=TokenExpiredError)` and throws `UnauthorizedException` ([auth.guard.ts](https://github.com/nestjs/passport/blob/master/lib/auth.guard.ts)). Net effect: expired token → **401**, the same as a missing or malformed one. To distinguish (e.g., custom error code for expiry), override `handleRequest(err, user, info)` and branch on `info instanceof TokenExpiredError`. |
| `secretOrKey`      | Same secret used in `JwtModule.register({ secret })` for signing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

`validate(payload)` is called **only after** the signature check passes: Passport guarantees the token is authentic. The return value becomes `request.user`. Throw `UnauthorizedException` here to reject otherwise-valid tokens (e.g., revoked-token list, banned users).

> [!info]- `JwtStrategy.validate()` runs **after** signature verification, not before
> By the time your `validate()` is called, Passport has already verified the signature and decoded the payload. Don't re-verify the token here: focus `validate()` on application-level checks: revocation list lookup, "is this user still active?", role enrichment. Throwing `UnauthorizedException` is the explicit way to reject. `@nestjs/passport`'s default `handleRequest` is `if (err || !user) throw err || new UnauthorizedException()` ([source](https://github.com/nestjs/passport/blob/master/lib/auth.guard.ts)): a falsy return becomes `401`, a thrown `HttpException` keeps its own status, and an `Error` from `validate()` itself surfaces as `500` (it arrives as `err`, not `info`). Errors emitted by passport-jwt during verification (`TokenExpiredError`, `JsonWebTokenError`) come through as `info` with `user=false`, so the default `handleRequest` still throws `UnauthorizedException` (401), not 500.

> [!info]- Returning `null`/`undefined` from `validate()` produces `Unauthorized`
> `@nestjs/passport`'s default `handleRequest` throws `UnauthorizedException` whenever the strategy returns a falsy value (`!user`). Errors thrown from inside `validate()` arrive as `err` and surface as their own status (`HttpException` keeps its status; a plain `Error` becomes `500` per Nest's [default exception filter](https://docs.nestjs.com/exception-filters#built-in-http-exceptions)). Verification errors emitted by passport-jwt (`TokenExpiredError`, `JsonWebTokenError`) take a different path: they're delivered as `info` with `user=false`, so the default guard still yields `401`. To distinguish them (e.g., a `403` for inactive users vs a custom code for expired tokens), override `handleRequest(err, user, info)` on the guard. Source: [Extending guards](https://docs.nestjs.com/recipes/passport#extending-guards).

Register the strategy in `AuthModule`:

```typescript
// auth/auth.module.ts (additions)
import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [/* … */ PassportModule],
  providers: [/* … */ JwtStrategy],
})
export class AuthModule {}
```

`PassportModule` must be imported in any module that registers a strategy. Adding `JwtStrategy` to `providers` is what binds the class to the name `'jwt'` in Passport's registry.

## Protected route

Wrap the strategy in a named guard, then apply it.

```typescript
// auth/jwt-auth.guard.ts
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
```

```typescript
// auth/auth.controller.ts (addition)
import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  @UseGuards(JwtAuthGuard)
  @Get("profile")
  getProfile(@Request() req: { user: { userId: number; username: string } }) {
    return req.user;
  }
}
```

Why subclass `AuthGuard('jwt')` instead of using it inline? Two reasons: it removes the magic string from your controllers, and it's the extension point for `@Public()`, custom error handling (`handleRequest`), or chaining strategies.

Request without a token:

```bash
curl http://localhost:3000/auth/profile
```

Response (`401 Unauthorized`):

```json
{ "statusCode": 401, "message": "Unauthorized" }
```

Request with the token from `/auth/login`:

```bash
curl http://localhost:3000/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Response (`200 OK`):

```json
{ "userId": 1, "username": "john" }
```

The body matches whatever `JwtStrategy.validate()` returned: that's the contract.

## Global guard with `@Public()` opt-out

Once more than a few routes need auth, flip the default: protect everything via the [[nestjs/fundamentals/global-providers|APP_GUARD token]], then mark the few public routes (login, health checks, signup) with `@Public()`.

```typescript
// auth/public.decorator.ts
import { SetMetadata } from "@nestjs/common";
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// auth/jwt-auth.guard.ts (replaces the trivial version)
import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

```typescript
// auth/auth.module.ts (additions)
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  providers: [
    /* … */
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
```

```typescript
// auth/auth.controller.ts (full file with @Public() on login)
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { Public } from "./public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  signIn(@Body() signInDto: { username: string; password: string }) {
    return this.authService.signIn(signInDto.username, signInDto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  getProfile(@Request() req: { user: { userId: number; username: string } }) {
    return req.user;
  }
}
```

Without `@Public()` on `/auth/login`, the global guard rejects the login request itself: `401 Unauthorized` before `signIn` runs. Classic chicken-and-egg.

The `getAllAndOverride` order `[handler, class]` means a method-level `@Public()` wins over a class-level decorator (it's a first-defined-wins lookup, per the [`Reflector` source](https://github.com/nestjs/nest/blob/master/packages/core/services/reflector.service.ts)). The convention is the same one used elsewhere in the framework (see the [[nestjs/fundamentals/guards|guards fundamental]]).

## When to reach for it

- API server with stateless clients (single-page app (SPA), mobile, server-to-server).
- Most or all endpoints need auth: pair with the global-guard + `@Public()` pattern.
- Multi-strategy auth where one of the strategies is JWT (`@UseGuards(AuthGuard(['jwt', 'apikey']))`).

## When not to

- Server-rendered apps with first-party login: a session cookie is simpler and revocable. JWTs are awkward to invalidate.
- Long-lived sessions: short-lived JWT + refresh token is a more involved setup; if the app doesn't need stateless scale, sessions cost less.
- Trivial single-user / dev tools: `BasicAuth` [[nestjs/fundamentals/middleware|middleware]] is fine, no Passport needed.

## Gotchas

> [!warning]- The same secret must be in `JwtModule` **and** `JwtStrategy`
> Signing happens in `auth.service.ts` via `JwtService.signAsync()` (configured by `JwtModule.register({ secret })`). Verification happens in `passport-jwt` via the strategy's `secretOrKey`. Mismatched secrets → every authenticated request gets `401 Unauthorized` with no useful error. Hoist the secret into a single `constants.ts` (or `ConfigService`) and import it in both places.

> [!warning]- `passport-jwt` strategies cannot be `Scope.REQUEST`
> Passport registers strategies on a global instance, so request-scoped strategies are never instantiated. If you need per-request data inside `validate()`, inject `ModuleRef` and resolve dependencies via `ContextIdFactory.getByRequest(request)` (also requires `passReqToCallback: true` in the strategy options). Source: [Request-scoped strategies](https://docs.nestjs.com/recipes/passport#request-scoped-strategies).

> [!warning]- Without `@Public()`, the login route also requires a token
> When `JwtAuthGuard` is the global `APP_GUARD`, every route: including `/auth/login`: runs through it. Forgetting `@Public()` on the login handler returns `401 Unauthorized` to every client and you'll think Passport is broken. Add `@Public()` to login, signup, and any health/status endpoints.

> [!info]- The strategy's default name is `'jwt'`, override with the second `PassportStrategy` arg
> `PassportStrategy(Strategy, 'myjwt')` registers the strategy under the name `'myjwt'` and you'd then use `AuthGuard('myjwt')` ([source](https://github.com/nestjs/passport/blob/master/lib/passport/passport.strategy.ts#L64-L72)). Useful when you have multiple JWT strategies (e.g., user tokens vs service tokens with different secrets).

> [!info]- Stateless JWT cannot be revoked
> Once issued, a valid JWT works until it expires. There's no server-side "log out". To revoke early, either keep token IDs (`jti`) in a denylist checked in `validate()`, or shorten `expiresIn` and rely on refresh-token rotation. The whole appeal of JWT (stateless verification) bites back here.

## Common errors

| Symptom                                                         | Likely cause                                                                                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Every authenticated request returns `401 Unauthorized`          | Secret mismatch between `JwtModule.register({ secret })` and `JwtStrategy({ secretOrKey })`                                              |
| `Unknown authentication strategy "jwt"`                         | `JwtStrategy` not listed in any module's `providers`, or `PassportModule` not imported                                                   |
| `req.user` is `undefined` inside the handler                    | The strategy's `validate()` returned `undefined`, OR the route isn't wrapped in `JwtAuthGuard`, OR the global guard sees `@Public()`     |
| `401` on `/auth/login` after enabling the global guard          | Missing `@Public()` on the login route                                                                                                   |
| `TypeError: super(...) is not a constructor` in `JwtStrategy`   | Imported `Strategy` from `passport` instead of `passport-jwt`                                                                            |
| `JsonWebTokenError: jwt malformed` in logs                      | Client sent the header without the `Bearer ` prefix, or sent a non-JWT token                                                             |
| `TokenExpiredError: jwt expired`                                | Working as designed. Issue a new token via login or refresh-token flow                                                                   |
| Custom guard runs but `super.canActivate()` returns a `Promise` | `AuthGuard.canActivate()` can return `boolean \| Promise<boolean> \| Observable<boolean>`. Always `return` it; never `await` and discard |

## See also

- [[nestjs/fundamentals/guards|Guards fundamental]]: the layer this recipe builds on. The `@Public()` pattern lives there too.
- [[nestjs/fundamentals/global-providers|DI-aware global providers]]: why `APP_GUARD` over `useGlobalGuards()`. Same mechanism applies to [[nestjs/fundamentals/pipes|pipes]], [[nestjs/fundamentals/interceptors|interceptors]], and filters.
- [[nestjs/recipes/validation|Validation recipe]]: replace the `Record<string, any>` body with a `LoginDto` validated by `class-validator`.
- Official docs: [Authentication (no Passport)](https://docs.nestjs.com/security/authentication), [Passport recipe](https://docs.nestjs.com/recipes/passport), [@nestjs/jwt README](https://github.com/nestjs/jwt), [passport-jwt README](https://github.com/mikenicholson/passport-jwt).
