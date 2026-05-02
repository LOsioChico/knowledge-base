---
title: Caching with @nestjs/cache-manager
aliases: [caching, cache, CacheModule, CacheInterceptor, cache-manager, Keyv, Redis cache]
tags: [type/recipe, tech/typescript]
area: nestjs
status: evergreen
related:
  - "[[nestjs/data/index]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/global-providers]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/recipes/rate-limiting]]"
  - "[[nestjs/releases/v10]]"
  - "[[nestjs/releases/v11]]"
source:
  - https://docs.nestjs.com/techniques/caching
  - https://github.com/nestjs/cache-manager
  - https://github.com/nestjs/cache-manager/blob/master/package.json
  - https://github.com/jaredwray/cacheable/tree/main/packages/cache-manager
  - https://github.com/jaredwray/cacheable/pull/1134
  - https://github.com/jaredwray/cacheable/commit/ea37202931e255b0dfd2f62d7121c84671b1f4fd
  - https://www.telerik.com/blogs/learning-nestjs-part-3-data-caching
  - https://keyv.org/docs/
---

> Cache responses or arbitrary values with `@nestjs/cache-manager`. In-memory by default, swappable to Redis (or any [Keyv](https://keyv.org/docs/) store) without changing call sites. Two surfaces: `CacheInterceptor` for "cache GET responses by URL" and the injectable `Cache` for "cache anything you want under a key you control".

## Setup

```shell
npm i @nestjs/cache-manager cache-manager
```

`@nestjs/cache-manager` v3+ uses `cache-manager` v6+, which delegates storage to [Keyv](https://keyv.org/docs/). All TTLs are in **milliseconds**.

## Minimal working example

Register `CacheModule` globally so any provider can inject the cache without re-importing:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { BooksController } from "./books.controller";
import { BooksService } from "./books.service";

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      ttl: 30_000, // 30 seconds, in MILLISECONDS
    }),
  ],
  controllers: [BooksController],
  providers: [BooksService],
})
export class AppModule {}
```

Use the cache imperatively from a service:

```typescript
// books.service.ts
import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER, type Cache } from "@nestjs/cache-manager";

export interface Book {
  id: string;
  title: string;
}

@Injectable()
export class BooksService {
  private readonly key = "books:all";

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    // ...your repository, omitted for brevity
  ) {}

  async findAll(): Promise<Book[]> {
    const hit = await this.cache.get<Book[]>(this.key);
    if (hit) return hit;

    const books = await this.fetchFromDb();
    await this.cache.set(this.key, books, 60_000); // 60s override
    return books;
  }

  async invalidate(): Promise<void> {
    await this.cache.del(this.key);
  }

  private async fetchFromDb(): Promise<Book[]> {
    // ...query the DB
    return [];
  }
}
```

`get()`'s return on a miss depends on the underlying `cache-manager` version: **v6 returns `null`**, **v7 returns `undefined`** (breaking change in [`cacheable@ea37202`](https://github.com/jaredwray/cacheable/commit/ea37202931e255b0dfd2f62d7121c84671b1f4fd) / cache-manager [PR #1134](https://github.com/jaredwray/cacheable/pull/1134), Jun 2025). `@nestjs/cache-manager@3.x` declares `peerDependencies.cache-manager: ">=6"` ([package.json](https://github.com/nestjs/cache-manager/blob/master/package.json)), so a fresh install gets v7 / `undefined` while an older lockfile gets v6 / `null`. The [official Nest cache docs](https://docs.nestjs.com/techniques/caching) call out both cases since [PR #3415](https://github.com/nestjs/docs.nestjs.com/pull/3415) (May 2026). Treat both as falsy and use `?? fallback` rather than relying on either. The `set()` third argument is the per-key TTL in milliseconds; omit it to fall back to the module default. Pass `0` to disable expiration entirely.

> [!warning] The default `ttl` is `0`, which means **never expire**
> If you call `CacheModule.register({})` without a `ttl`, every entry stays until `del()` or `clear()` is called. That's almost never what you want for HTTP responses. Set `ttl` explicitly at the module level, then override per key when needed.

## Auto-caching GET responses

If all you want is "cache this endpoint's response by URL", skip the imperative API and bind `CacheInterceptor`:

```typescript
// books.controller.ts
import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { CacheInterceptor, CacheTTL, CacheKey } from "@nestjs/cache-manager";
import { BooksService, Book } from "./books.service";

@Controller("books")
@UseInterceptors(CacheInterceptor)
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  @CacheTTL(60_000) // override the module default for this route
  findAll(): Promise<Book[]> {
    return this.books.findAll();
  }

  @Get("featured")
  @CacheKey("books:featured") // explicit key instead of the URL
  @CacheTTL(5 * 60_000)
  featured(): Promise<Book[]> {
    return this.books.findFeatured();
  }
}
```

Bind globally instead of per-controller via the [[nestjs/fundamentals/global-providers|APP_INTERCEPTOR token]]:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { CacheInterceptor, CacheModule } from "@nestjs/cache-manager";

@Module({
  imports: [CacheModule.register({ isGlobal: true, ttl: 30_000 })],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {}
```

> [!warning] `CacheInterceptor` only caches `GET` and breaks on `@Res()`
> Two silent failure modes baked into the interceptor:
>
> 1. Non-`GET` handlers (`POST`, `PUT`, `PATCH`, `DELETE`) are passed through untouched. No error, just no caching.
> 2. Handlers that inject `@Res() res: Response` and write to the response directly bypass the [[nestjs/fundamentals/interceptors|interceptor pipeline]] entirely. The cache is never populated and never read for that route.
>
> Symptom in both cases: the endpoint works but the cache stays empty. If you need write-side caching or you're using `@Res()`, drop the interceptor and use `CACHE_MANAGER` directly.

> [!warning] Auto-caching does not work in GraphQL
> In a GraphQL app, interceptors run **per field resolver**, not once per request. `CacheInterceptor` keys by request URL, so every resolver collides on the same key and clobbers each other. Cache imperatively in the resolver or service instead.

## Configuration reference

| Option     | Type      | Default     | Notes                                                                                                           |
| ---------- | --------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `ttl`      | `number`  | `0` (never) | Default expiration in **milliseconds**. Override per call with `set(k, v, ttl)`                                 |
| `isGlobal` | `boolean` | `false`     | Skip re-importing `CacheModule` in feature modules                                                              |
| `stores`   | `Keyv[]`  | in-memory   | One or more [Keyv](https://keyv.org/docs/) stores. See [the Redis section below](#distributed-cache-with-redis) |

The per-route decorators from `@nestjs/cache-manager`:

| Decorator                            | Scope                | Purpose                                                    |
| ------------------------------------ | -------------------- | ---------------------------------------------------------- |
| `@UseInterceptors(CacheInterceptor)` | Controller/method    | Enable auto-caching on the bound surface                   |
| `@CacheKey(key)`                     | Method or controller | Override the auto-generated URL-based key                  |
| `@CacheTTL(ms)`                      | Method or controller | Override the module-level TTL. Method wins over controller |

## Distributed cache with Redis

The default in-memory store is **per-process**. Two pods, two caches: a write on pod A is invisible to pod B, and `del()` only invalidates one of them. Past one instance, switch to a shared store via Keyv.

```shell
npm i @keyv/redis keyv cacheable
```

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { Keyv } from "keyv";
import KeyvRedis from "@keyv/redis";
import { KeyvCacheableMemory } from "cacheable";

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        ttl: 30_000,
        stores: [
          // L1: in-process LRU, fast but local
          new Keyv({ store: new KeyvCacheableMemory({ ttl: 30_000, lruSize: 5_000 }) }),
          // L2: shared, survives restarts and is visible across pods
          new KeyvRedis(process.env.REDIS_URL ?? "redis://localhost:6379"),
        ],
      }),
    }),
  ],
})
export class AppModule {}
```

The `stores` array is a tiered cache: reads check stores in order until one returns a value, and `set`/`del` hit each store in order (set `nonBlocking: true` to fire them in parallel and not wait). The first store is the "fast path"; later stores are fallbacks. With Redis alone, pass a single-element array.

> [!info] Why Keyv and not the legacy `cache-manager-redis-store`
> `cache-manager` v6 dropped its own store registry and now consumes Keyv stores directly. The pre-v3 NestJS pattern (`store: redisStore`, `store: 'redis'`) no longer applies. If you're migrating from an older project, the install line and the `register()` shape both change.

## Async configuration

When the cache config depends on `ConfigService` (or any other provider), use `registerAsync()`:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Keyv } from "keyv";
import KeyvRedis from "@keyv/redis";

@Module({
  imports: [
    ConfigModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ttl: config.get<number>("CACHE_TTL_MS", 30_000),
        stores: [new KeyvRedis(config.getOrThrow<string>("REDIS_URL"))],
      }),
    }),
  ],
})
export class AppModule {}
```

## Custom tracking (cache by header, not URL)

Default `CacheInterceptor` keys by request URL. To key by something else (e.g., user ID from a JWT to avoid leaking one user's response to another), subclass and override `trackBy()`:

```typescript
// http-cache.interceptor.ts
import { ExecutionContext, Injectable } from "@nestjs/common";
import { CacheInterceptor } from "@nestjs/cache-manager";
import { Request } from "express";

@Injectable()
export class HttpCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    if (req.method !== "GET") return undefined; // skip non-GETs explicitly
    const userId = req.user?.id ?? "anon";
    return `${userId}:${req.originalUrl}`;
  }
}
```

Returning `undefined` from `trackBy()` makes the interceptor skip caching for that request. Bind `HttpCacheInterceptor` exactly like the built-in one (per controller, per route, or globally via `APP_INTERCEPTOR`).

> [!warning] Authenticated responses without `trackBy` leak across users
> The default key is the request URL ([Nest caching docs → Different stores](https://docs.nestjs.com/techniques/caching) describes the auto-caching behavior). `GET /me` from Alice and Bob is the **same URL**, so without a custom `trackBy()` Bob will get Alice's cached response. For per-user caching, always subclass and include the user identifier in the key, or skip auto-caching and use the imperative `CACHE_MANAGER` API with explicit per-user keys.

## Gotchas

- **TTL units bite once**: every TTL is milliseconds. `ttl: 60` is 60 ms, not 60 seconds. The official docs are consistent on this; older blog posts that show `ttl: 60` for "60 seconds" predate v3 and are now wrong.
- **No automatic invalidation on writes**: `CacheInterceptor` populates the cache but never invalidates it. A `POST /books` that adds a row will not bust the `GET /books` cache. Either call `cache.del()` from the write handler, set short TTLs, or accept staleness.
- **In-memory store loses everything on restart**: every redeploy clears the cache. For caches whose miss-rate cost matters (DB query that takes 2s), use Redis from day one.
- **Structured-clone-only values for in-memory**: the in-memory store can only hold values supported by [the structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm). Class instances lose their prototype on read; convert to plain objects before storing if you need methods back.
- **`@CacheKey()` is static**: it's a decorator, evaluated once at class load. You cannot key by a path param like `:id` with `@CacheKey()` alone. Use the imperative API (`cache.get(\`book:${id}\`)`) or a custom `trackBy()` for dynamic keys.

## See also

- [[nestjs/fundamentals/interceptors|Interceptors]] for how `CacheInterceptor` plugs into the [[nestjs/fundamentals/request-lifecycle|request pipeline]]
- [[nestjs/fundamentals/global-providers|Global providers via DI]] for the `APP_INTERCEPTOR` registration pattern used above
- [[nestjs/recipes/rate-limiting|Rate limiting with @nestjs/throttler]] for the parallel "Redis-when-multi-instance" story applied to throttling state
- [Official NestJS caching docs](https://docs.nestjs.com/techniques/caching): primary source for all signatures and behaviors above
- [`cache-manager` repo](https://github.com/jaredwray/cache-manager) and [Keyv docs](https://keyv.org/docs/) for the underlying storage layer and the full list of available stores
- [Telerik: Learning NestJS Part 3, Data Caching](https://www.telerik.com/blogs/learning-nestjs-part-3-data-caching): extended walkthrough that includes an Azure Cache for Redis setup. Note: the post predates `@nestjs/cache-manager@3.x`, so its `@CacheTTL(60)` example assumes seconds; current v3 takes milliseconds, so use `@CacheTTL(60_000)` instead.
