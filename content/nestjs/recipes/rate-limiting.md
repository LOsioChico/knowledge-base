---
title: Rate limiting with @nestjs/throttler
aliases: [rate limiting, throttling, throttler, ThrottlerGuard]
tags: [type/recipe, tech/http, errors]
area: nestjs
status: evergreen
related:
  - "[[nestjs/recipes/index]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/auth/jwt-strategy]]"
  - "[[nestjs/data/caching]]"
source:
  - https://docs.nestjs.com/security/rate-limiting
  - https://github.com/nestjs/throttler
  - https://www.telerik.com/blogs/rate-limiting-nestjs-using-throttler
---

> Cap how many requests a single client can fire at your API in a time window. `@nestjs/throttler` ships a [[nestjs/fundamentals/guards|guard]] you bind globally; per-route overrides come from two decorators. In-memory store by default, Redis when you scale past one instance.

## Setup

```shell
npm i --save @nestjs/throttler
```

No extra `@types/*` package: the library ships its own types. Requires `@nestjs/throttler` v5 or newer; older versions used a different decorator and option shape.

## Minimal working example

Rate-limit every route in the app to **10 requests per 60 seconds** per client IP:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard, seconds } from "@nestjs/throttler";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: seconds(60),
        limit: 10,
      },
    ]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

Two pieces:

- `ThrottlerModule.forRoot([{ ttl, limit }])` configures one bucket: `ttl` is the window in **milliseconds**, `limit` is the max requests in that window.
- The `APP_GUARD` provider registers `ThrottlerGuard` globally, so it runs on every route without `@UseGuards()` clutter. Always register through the provider rather than `useGlobalGuards(new ThrottlerGuard())`; see [[nestjs/fundamentals/guards|Guards]] for the full DI rationale.

The 11th request inside the same minute returns:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "statusCode": 429,
  "message": "ThrottlerException: Too Many Requests"
}
```

The exception is `ThrottlerException` extending `HttpException(429)`, so any [[nestjs/fundamentals/exception-filters|exception filter]] that catches `HttpException` will see it.

## Per-route overrides

Two decorators tighten or loosen the global setting on a specific controller or method.

### `@Throttle()`: set custom `limit`/`ttl`

```typescript
import { Controller, Post, Body } from "@nestjs/common";
import { Throttle, seconds } from "@nestjs/throttler";
import { LoginDto } from "./login.dto";

@Controller("auth")
export class AuthController {
  // 5 attempts per minute on this route, regardless of the global default.
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post("login")
  login(@Body() dto: LoginDto) {
    // ...
  }
}
```

The outer key (`default`) is the **throttler name**. With a single unnamed bucket (the example above), use `default`. With named buckets (next section), key by name.

### `@SkipThrottle()`: opt out

```typescript
import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";

@SkipThrottle()
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { ok: true };
  }
}
```

Skips throttling for the entire controller. Useful for health checks, readiness probes, and webhook receivers that legitimately burst.

## Multiple named throttlers

Stack different windows on top of each other (burst protection + sustained protection):

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard, seconds, minutes } from "@nestjs/throttler";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: "short", ttl: seconds(1), limit: 3 }, // burst: 3/s
      { name: "medium", ttl: seconds(10), limit: 20 }, // 20/10s
      { name: "long", ttl: minutes(1), limit: 100 }, // 100/min
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

Per-route overrides now have to name which bucket they touch:

```typescript
import { Controller, Get } from "@nestjs/common";
import { Throttle, SkipThrottle, seconds } from "@nestjs/throttler";

@Controller("reports")
export class ReportsController {
  // Tighten only the short window; medium/long stay at the global setting.
  @Throttle({ short: { limit: 1, ttl: seconds(1) } })
  @Get("expensive")
  expensive() {
    return { ok: true };
  }

  // Skip burst protection but keep medium/long limits.
  @SkipThrottle({ short: true })
  @Get("polled-by-dashboard")
  polled() {
    return { ok: true };
  }
}
```

> [!warning]- Bare `@SkipThrottle()` does nothing when buckets are named
> With named buckets, `@SkipThrottle()` (no argument) silently fails to skip anything. You must pass `{ <name>: true }` for each bucket you want to skip. The route still gets throttled and you'll spend an afternoon wondering why. Same trap for `@Throttle()` without a key.

## Configuration reference

Each entry in the `forRoot` array (or under `throttlers:` if you also need top-level options) accepts:

| Option             | Type                                      | Default     | Notes                                                                                                                                                                                                |
| ------------------ | ----------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`             | `string`                                  | `'default'` | Used as the key in `@Throttle({ <name>: ... })` and `@SkipThrottle({ <name>: true })`                                                                                                                |
| `ttl`              | `number` (ms)                             | required    | Window length. Wrap with `seconds()`/`minutes()`/`hours()` for readability                                                                                                                           |
| `limit`            | `number`                                  | required    | Max requests per `ttl` per tracker                                                                                                                                                                   |
| `blockDuration`    | `number` (ms)                             | `ttl`       | How long to keep blocking after the limit is hit. Defaults to `ttl` per [`ThrottlerModuleOptions` source](https://github.com/nestjs/throttler/blob/master/src/throttler-module-options.interface.ts) |
| `ignoreUserAgents` | `RegExp[]`                                | `[]`        | Skip throttling for matching `User-Agent` headers                                                                                                                                                    |
| `skipIf`           | `(ctx: ExecutionContext) => boolean`      | none        | Programmatic skip. Same intent as `@SkipThrottle()` but request-driven                                                                                                                               |
| `getTracker`       | `(req, ctx) => string \| Promise<string>` | `req.ip`    | Override the per-client identity. See [proxies callout below](#proxies-and-trust-proxy)                                                                                                              |
| `generateKey`      | `(ctx, tracker, name) => string`          | internal    | Override the storage key shape                                                                                                                                                                       |

Top-level options (passed as `ThrottlerModule.forRoot({ throttlers: [...], ...topLevel })`):

| Option         | Type                                  | Notes                                                                                                   |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `storage`      | `ThrottlerStorage`                    | Swap the default in-memory store. Required for [multi-instance deployments](#distributed-storage-redis) |
| `errorMessage` | `string \| ((ctx, detail) => string)` | Override the `429` body text                                                                            |

Time helpers exported from `@nestjs/throttler`: `seconds`, `minutes`, `hours`, `days`, `weeks`. They just multiply by the right constant: `seconds(5) === 5000`. Prefer them over raw numbers; `60000` reads as "what unit?".

## How the storage key is built

Every counter in the store lives under a key shaped like ([`generateKey` default in `ThrottlerGuard`](https://github.com/nestjs/throttler/blob/master/src/throttler.guard.ts)):

```
sha256("<ControllerClass>-<handler>-<throttlerName>-<tracker>")
```

Where `<tracker>` is whatever `getTracker(req, ctx)` returns (default: `req.ip`) and `<throttlerName>` is the `name` you set in `forRoot` (default: `"default"`). Two consequences worth internalizing:

- **Buckets are per route, per throttler.** `/users` and `/orders` get separate counters even for the same client; the `short` and `long` named throttlers from the [previous section](#multiple-named-throttlers) also get separate counters. That's the right default for a global guard, but it means "10 req/min" is enforced per handler, not across the whole app.
- **The tracker is the only knob that identifies the client.** If `req.ip` is wrong (proxies, see below) or too coarse (one IP for an office), every counter in every bucket is wrong. Fix the tracker, not the throttler config.

## Proxies and `trust proxy`

The default tracker is `req.ip`. Behind a load balancer or reverse proxy, that's the proxy's IP: every client looks identical and you'll throttle the entire world as one. Two-step fix:

**1. Tell Express to trust the proxy** so `req.ip` resolves to the `X-Forwarded-For` value:

```typescript
// main.ts
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set("trust proxy", "loopback"); // or specific subnet, or `1` for one hop
  await app.listen(3000);
}
bootstrap();
```

**2. (Fastify only)** Override the tracker because Fastify exposes the chain at `req.ips`, not `req.ip`:

```typescript
// throttler-behind-proxy.guard.ts
import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.ips.length ? req.ips[0] : req.ip;
  }
}
```

Then bind `ThrottlerBehindProxyGuard` instead of `ThrottlerGuard` in the `APP_GUARD` provider.

> [!warning]- Misconfiguring `trust proxy` is a real footgun
> Set `trust proxy` to `true` blindly and any client can spoof `X-Forwarded-For` to bypass throttling. Use the narrowest setting that matches your deployment: `'loopback'` (proxy on same host), a CIDR like `'10.0.0.0/8'`, or an exact integer hop count. The same caveat applies to anything else that reads `req.ip`, not just throttling. See [Express docs](https://expressjs.com/en/guide/behind-proxies.html).

## Custom tracker (per-user, per-API-key)

IP-based throttling fairness drops on shared networks (offices, VPNs, mobile carriers). For authenticated routes, key the bucket on the user instead:

```typescript
// user-throttler.guard.ts
import { Injectable, ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Request } from "express";

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const user = (req as Request & { user?: { id: string } }).user;
    // Fall back to IP for unauthenticated requests so anonymous floods are still capped.
    return user?.id ?? req.ip ?? "anonymous";
  }
}
```

Bind this guard on the routes that have authentication run before it (so `req.user` is populated). Globally that means `APP_GUARD` order matters: an auth guard registered earlier in the providers array runs first.

## Distributed storage (Redis)

The built-in storage is a per-process in-memory map. Two pods, two counters: a client gets `2 × limit` before being throttled. For anything past one instance, plug in a shared store via the `storage` option. Community providers exist for [Redis (`ioredis`)](https://github.com/jmcdo29/nest-lab/tree/main/packages/throttler-storage-redis) and [Redis (`node-redis`)](https://github.com/CSenshi/nestjs-redis/tree/main/packages/throttler-storage). Any class implementing `ThrottlerStorage` (re-exported from `@nestjs/throttler`) works.

```typescript
// app.module.ts (sketch: install the storage package first)
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import Redis from "ioredis";

ThrottlerModule.forRoot({
  throttlers: [{ ttl: seconds(60), limit: 10 }],
  storage: new ThrottlerStorageRedisService(new Redis(process.env.REDIS_URL!)),
});
```

> [!info]- The in-memory store is fine for single-process apps and dev
> If you're running one pod, one container, no horizontal scaling, the default store is correct. The trade-off is memory growth proportional to active trackers; the store cleans expired entries lazily. Switch to Redis when you add a second instance, not before.

## Async configuration

Pull `ttl`/`limit` from `ConfigService` instead of hard-coding them:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";

@Module({
  imports: [
    ConfigModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>("THROTTLE_TTL_MS")!,
          limit: config.get<number>("THROTTLE_LIMIT")!,
        },
      ],
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

## Gotchas

> [!warning]- `ttl` is **milliseconds** in v5+
> Pre-v5, `@Throttle(10, 60)` meant 10 requests per 60 **seconds**. From v5 onward, both options are positional-by-key (`{ limit: 10, ttl: 60 }`) and `ttl` is **milliseconds**. Writing `ttl: 60` now means 60ms, which is functionally "no throttling at all". Use the `seconds()` helper or write the full milliseconds.

> [!warning]- WebSockets need a custom subclass and can't use `APP_GUARD`
> The default `ThrottlerGuard` reads from the HTTP context. For WebSockets, extend it and override `handleRequest` to pull the client from `context.switchToWs()`. The guard cannot be registered via `APP_GUARD` or `app.useGlobalGuards()`: bind it on the gateway with `@UseGuards()` instead. See the [official WebSockets snippet](https://docs.nestjs.com/security/rate-limiting#websockets) for the full `handleRequest` shape.

> [!info]- The `429` body is generic by default
> The default response is `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests" }`. There's no `Retry-After` header out of the box. If you need one (most public APIs do), override via the `errorMessage` option or write a small filter on `ThrottlerException` that sets the header from `ThrottlerLimitDetail.timeToExpire`.

## See also

- [[nestjs/fundamentals/guards|Guards]]: `ThrottlerGuard` is just another guard; the binding rules and DI traps apply.
- [[nestjs/fundamentals/exception-filters|Exception filters]]: for customizing the `429` response shape or adding `Retry-After`.
- [[nestjs/auth/jwt-strategy|JWT strategy]]: the natural pairing for per-user throttling (auth runs first, throttler reads `req.user`).
- Official: [Rate limiting](https://docs.nestjs.com/security/rate-limiting), [`@nestjs/throttler` repo](https://github.com/nestjs/throttler).
- Extended walkthrough: [Rate limiting NestJS using Throttler](https://www.telerik.com/blogs/rate-limiting-nestjs-using-throttler) (Telerik, Christian Nwamba). Adds a conceptual primer on rate-limiting algorithms and a worked Nginx + Docker Compose + Redis multi-instance demo. Note: it sets blanket `app.set('trust proxy', true)`, which this recipe argues against.
