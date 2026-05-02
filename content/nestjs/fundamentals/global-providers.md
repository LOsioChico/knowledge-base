---
title: Global pipes, guards, interceptors, and filters via DI
aliases: [APP_PIPE, APP_GUARD, APP_INTERCEPTOR, APP_FILTER, global providers, DI-aware globals]
tags: [type/concept, tech/typescript]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/index]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/recipes/validation]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/auth/jwt-strategy]]"
  - "[[nestjs/recipes/trace-id]]"
  - "[[nestjs/recipes/rate-limiting]]"
  - "[[nestjs/data/caching]]"
source:
  - https://docs.nestjs.com/pipes#global-scoped-pipes
  - https://docs.nestjs.com/guards#binding-guards
  - https://docs.nestjs.com/interceptors#binding-interceptors
  - https://docs.nestjs.com/exception-filters#binding-filters
  - https://docs.nestjs.com/faq/hybrid-application
  - https://docs.nestjs.com/fundamentals/testing#overriding-globally-registered-enhancers
  - https://github.com/nestjs/nest/blob/master/packages/core/constants.ts
  - https://github.com/nestjs/nest/blob/master/packages/core/router/router-exception-filters.ts
  - https://github.com/nestjs/nest/blob/master/packages/core/guards/guards-context-creator.ts
  - https://github.com/nestjs/nest/blob/master/packages/core/pipes/pipes-context-creator.ts
  - https://github.com/nestjs/nest/blob/master/packages/core/interceptors/interceptors-context-creator.ts
---

> Two ways to register a global pipe / guard / interceptor / exception filter. They look interchangeable. They are not.

## The two registrations

### 1. Bound on the application instance

```ts
// main.ts
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AuthGuard } from "./auth.guard";
import { LoggingInterceptor } from "./logging.interceptor";
import { HttpExceptionFilter } from "./http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalGuards(new AuthGuard());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(3000);
}
bootstrap();
```

The component is `new`'d **outside the DI container**. Nest never sees its constructor. Whatever you pass is what you get.

### 2. Registered as a provider with an `APP_*` token

```ts
// app.module.ts
import { Module, ValidationPipe } from "@nestjs/common";
import { APP_PIPE, APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from "@nestjs/core";
import { AuthGuard } from "./auth.guard";
import { LoggingInterceptor } from "./logging.interceptor";
import { HttpExceptionFilter } from "./http-exception.filter";

@Module({
  providers: [
    { provide: APP_PIPE, useClass: ValidationPipe },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```

The container instantiates the component, so it can inject other providers, run with request scope, and play nicely with hybrid apps. The provider can be declared in **any** module: regardless of where the construction sits, the enhancer is global ([Binding guards → hint](https://docs.nestjs.com/guards#binding-guards) explicitly notes "regardless of the module where this construction is employed, the guard is, in fact, global"; the same wording appears for [pipes](https://docs.nestjs.com/pipes#binding-pipes), [interceptors](https://docs.nestjs.com/interceptors#binding-interceptors), and [filters](https://docs.nestjs.com/exception-filters#binding-filters)).

## Side-by-side

`useGlobal*` is the **shortcut**: instantiate it yourself, no DI, no surprises. `APP_*` is the **DI-aware** version: the container builds it, so it can inject providers, take request scope, and apply to hybrid apps. Same effect on the wire; different powers under the hood.

| Concern                                                                                            | `app.useGlobalX(new T())`            | `{ provide: APP_X, useClass: T }`                                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Can inject providers (`ConfigService`, repositories, loggers)                                      | ❌                                   | ✅                                                                                       |
| Supports request scope                                                                             | ❌                                   | ✅                                                                                       |
| Applies to gateways/microservices in [hybrid apps](https://docs.nestjs.com/faq/hybrid-application) | ❌ unless `inheritAppConfig: true`   | ✅ (community-confirmed; not in the official hybrid-app page — verify on your transport) |
| Where it lives                                                                                     | `main.ts`, near `NestFactory.create` | Any module's `providers` array                                                           |
| Can pass options as a literal object                                                               | ✅ trivially                         | ⚠️ via `useValue` or `useFactory`                                                        |

Rule of thumb: **stateless component + static config → either works**. **Needs DI or request scope → `APP_*` provider**.

## Worked example: when `useGlobalPipes()` is enough

A stock `ValidationPipe` with literal options. No injection needed:

```ts
// main.ts
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(3000);
}
bootstrap();
```

## Worked example: when you must use `APP_PIPE`

Suppose `whitelist` should be on in production but off locally so QA can post extra debug fields. The flag lives in `ConfigService`, which is a provider:

```ts
// validation.config.ts
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_PIPE } from "@nestjs/core";

export const validationPipeProvider = {
  provide: APP_PIPE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new ValidationPipe({
      whitelist: config.get<boolean>("STRICT_VALIDATION", true),
      transform: true,
    }),
};
```

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validationPipeProvider } from "./validation.config";

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [validationPipeProvider],
})
export class AppModule {}
```

With `useGlobalPipes(new ValidationPipe({ whitelist: ??? }))` in `main.ts`, `ConfigService` isn't resolvable yet: the app instance exists but you'd be injecting by hand (`app.get(ConfigService)`). The `APP_PIPE` provider lets Nest wire it for you.

## Worked example: a guard that reads the current request

Request-scoped components only work when the container constructs them. A `TenantGuard` that depends on the inbound `Request`:

```ts
// tenant.guard.ts
import { CanActivate, ExecutionContext, Inject, Injectable, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import type { Request } from "express";
import { TenantService } from "./tenant.service";

@Injectable({ scope: Scope.REQUEST })
export class TenantGuard implements CanActivate {
  constructor(
    @Inject(REQUEST) private readonly req: Request,
    private readonly tenants: TenantService,
  ) {}

  async canActivate(_: ExecutionContext): Promise<boolean> {
    const tenantId = this.req.header("x-tenant-id");
    return tenantId ? this.tenants.exists(tenantId) : false;
  }
}
```

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TenantGuard } from "./tenant.guard";
import { TenantService } from "./tenant.service";

@Module({
  providers: [TenantService, { provide: APP_GUARD, useClass: TenantGuard }],
})
export class AppModule {}
```

`app.useGlobalGuards(new TenantGuard(/* what do I pass here? */))` is unreachable: there is no request to inject, and `TenantService` lives in the container.

## Worked example: an interceptor that reads config

A common case: an interceptor whose behavior depends on a runtime flag from `ConfigService`.

```ts
// audit.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (!this.config.get<boolean>("AUDIT_ENABLED")) return next.handle();
    // …log to your audit sink
    return next.handle();
  }
}
```

```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditInterceptor } from "./audit.interceptor";

@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
```

`app.useGlobalInterceptors(new AuditInterceptor(/* ??? */))` is unreachable: you'd be calling `new` yourself with no `ConfigService` in scope. Rule of thumb: **if the interceptor has any constructor dependency, use `APP_INTERCEPTOR`**. Same logic applies to a guard with `Reflector` plus an injected `UsersService`, a filter that needs the request-scoped `Logger`, and so on.

## Hybrid apps gotcha

> [!warning] `app.useGlobalX()` does not cover gateways or microservice transports by default
> In a [hybrid app](https://docs.nestjs.com/faq/hybrid-application), `app.useGlobalGuards()` / `useGlobalPipes()` / etc. apply only to the HTTP layer. Microservice listeners and WebSocket gateways stay uncovered. Two fixes:
>
> 1. Pass `{ inheritAppConfig: true }` when calling `app.connectMicroservice(...)`.
> 2. Register via `APP_GUARD` (or `APP_PIPE` / `APP_INTERCEPTOR` / `APP_FILTER`). Provider-bound globals are picked up by Nest's enhancer registries the same way for every transport, so they apply across HTTP, microservices, and gateways without an `inheritAppConfig` flag.

## Picking between `useClass`, `useValue`, and `useFactory`

| Form         | When to reach for it                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| `useClass`   | Your component has a constructor and Nest can resolve every dep from the container.   |
| `useValue`   | You need a pre-built instance with literal options (e.g., `new ValidationPipe({…})`). |
| `useFactory` | Construction depends on async work, env vars, or providers you must inject manually.  |

```ts
// Imports for the snippets below:
//   import { Logger, ValidationPipe } from "@nestjs/common";
//   import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
//   import { LoggingInterceptor } from "./logging.interceptor";
//   import { SentryFilter } from "./sentry.filter";

// useClass: most common
{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }

// useValue: keeps pipe options inline
{ provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) }

// useFactory: pulls config from another provider
{
  provide: APP_FILTER,
  inject: [Logger],
  useFactory: (logger: Logger) => new SentryFilter(logger, { release: process.env.RELEASE }),
}
```

## Edge cases worth knowing

- **Multiple registrations stack.** You can register the same `APP_*` token more than once across modules; all of them run. Good for layering (e.g., a `LoggingInterceptor` plus a `TimeoutInterceptor`).
- **Mixing `useGlobalPipes` and an `APP_PIPE` provider** isn't addressed by the official docs. Pick one binding style per enhancer kind so you never have to reason about ordering.
- **No need to add `APP_*` to `exports`.** The framework collects enhancer providers from any module's `providers` array, so the usual cross-module export contract doesn't apply (none of the official binding examples in the [pipes](https://docs.nestjs.com/pipes#binding-pipes), [guards](https://docs.nestjs.com/guards#binding-guards), [interceptors](https://docs.nestjs.com/interceptors#binding-interceptors), or [exception-filters](https://docs.nestjs.com/exception-filters#binding-filters) docs export the `APP_*` token).
- **Testing.** The `APP_*` token is a regular DI provider, so `Test.createTestingModule(...)` resolves it like any other and `.overrideProvider(APP_GUARD).useClass(MockGuard)` works (see [Testing → Overriding globally registered enhancers](https://docs.nestjs.com/fundamentals/testing#overriding-globally-registered-enhancers)). The `useGlobalX` form bypasses the testing module entirely.

## See also

- [[nestjs/fundamentals/pipes|Pipes]]: binding scopes table.
- [[nestjs/fundamentals/guards|Guards]]: `APP_GUARD` is the default for auth.
- [[nestjs/fundamentals/interceptors|Interceptors]]: same registration story.
- [[nestjs/fundamentals/exception-filters|Exception filters]]: `APP_FILTER` for global error handling.
- [[nestjs/recipes/validation|Validation recipe]]: the most common reason to reach for `APP_PIPE`.
- Official docs: [Hybrid application](https://docs.nestjs.com/faq/hybrid-application).
