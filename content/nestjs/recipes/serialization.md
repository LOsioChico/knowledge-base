---
title: Response serialization with class-transformer
aliases: [class-serializer, ClassSerializerInterceptor, exclude fields, expose fields]
tags: [type/recipe, tech/class-transformer, tech/http]
area: nestjs
status: evergreen
related:
  - "[[nestjs/recipes/index]]"
  - "[[nestjs/recipes/validation]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/pipes]]"
source:
  - https://docs.nestjs.com/techniques/serialization
  - https://github.com/typestack/class-transformer
  - https://github.com/nestjs/nest/blob/master/packages/common/serializer/class-serializer.interceptor.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/package.json
  - https://github.com/typeorm/typeorm/blob/master/docs/docs/working-with-entity-manager/6-repository-api.md
  - https://www.prisma.io/docs/orm/prisma-client/queries/crud
  - https://github.com/Automattic/mongoose/blob/master/docs/tutorials/lean.md
  - https://typeorm.io/repository-api
  - https://www.prisma.io/docs/orm/prisma-client/queries
  - https://mongoosejs.com/docs/tutorials/lean.html
---

> Strip secrets, rename fields, and expose role-specific views of the same entity. NestJS hands the response to `class-transformer` via `ClassSerializerInterceptor`, which calls `instanceToPlain` on whatever the controller returned.

## When to reach for it

You hit this the first time a `User` entity leaks `password` or `passwordHash` in an API response. Other common cases:

- Rename internal column names (`emailAddress` in DB, `email` over the wire).
- Hide admin-only fields (`internalNotes`, `auditLog`) from non-admin callers.
- Compute derived fields (`fullName` from `firstName` + `lastName`) without polluting the entity.
- Format dates / numbers consistently across every endpoint.

## Setup

```shell
npm i class-transformer reflect-metadata
```

`class-transformer` is declared as an **optional** peer dependency of [`@nestjs/common`](https://github.com/nestjs/nest/blob/master/packages/common/package.json) (`peerDependenciesMeta.class-transformer.optional: true`), so npm won't install it for you. Install it explicitly when you use the serializer: `ClassSerializerInterceptor` imports `instanceToPlain` from it. `reflect-metadata` is already required by Nest itself.

## Wire up the interceptor

Bind it globally so every endpoint runs through the serializer. No more `@UseInterceptors(ClassSerializerInterceptor)` per controller.

```typescript
import { ClassSerializerInterceptor, Module } from "@nestjs/common";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) => new ClassSerializerInterceptor(reflector),
      inject: [Reflector],
    },
  ],
})
export class AppModule {}
```

Why the factory: `ClassSerializerInterceptor`'s constructor takes a `Reflector` (see [`class-serializer.interceptor.ts`](https://github.com/nestjs/nest/blob/master/packages/common/serializer/class-serializer.interceptor.ts)) so it can read `@SerializeOptions()` metadata. The shorthand `{ provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor }` works too because Nest resolves the constructor deps automatically; the factory form is explicit and survives if you ever wrap or extend the interceptor.

## The decorators

Decorate the entity / DTO class with `class-transformer` decorators. The interceptor reads them and rewrites the response.

> All examples below assume the global `ClassSerializerInterceptor` from [the previous section](#wire-up-the-interceptor) is wired up. Without it, the decorators are inert.

### `@Exclude()`

Drops the field from the response. Apply per-property or at class level.

```typescript
import { Controller, Get, Param } from "@nestjs/common";
import { Exclude } from "class-transformer";

export class UserEntity {
  id: number;
  email: string;
  @Exclude() password: string;
  @Exclude() passwordResetToken: string;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}

@Controller("users")
export class UsersController {
  @Get(":id")
  findOne(@Param("id") id: string): UserEntity {
    // The handler still sees password/passwordResetToken on the instance.
    return new UserEntity({
      id: Number(id),
      email: "a@b.c",
      password: "hunter2",
      passwordResetToken: "abc123",
    });
  }
}
```

`GET /users/1` returns:

```json
{ "id": 1, "email": "a@b.c" }
```

`password` and `passwordResetToken` are stripped on the way out by the globally-bound `ClassSerializerInterceptor`. The handler still has access to them inside the controller: the stripping happens after `return`.

### `@Expose()` and `excludeAll` strategy

Flip the default: hide everything, then opt fields in. Safer for accidental leaks when you add a new column to the entity.

```typescript
import { Controller, Get, Param } from "@nestjs/common";
import { Exclude, Expose, plainToInstance } from "class-transformer";

@Exclude()
export class UserDto {
  @Expose() id: number;
  @Expose() email: string;
  passwordHash: string; // not @Expose()'d, so excluded
  internalNote: string; // same
}

@Controller("users")
export class UsersController {
  @Get(":id")
  findOne(@Param("id") id: string): UserDto {
    // Pretend this came from the database.
    const row = {
      id: Number(id),
      email: "a@b.c",
      passwordHash: "$2b$...",
      internalNote: "flagged for review",
    };
    return plainToInstance(UserDto, row);
  }
}
```

`GET /users/1` returns:

```json
{ "id": 1, "email": "a@b.c" }
```

Adding a new column to the entity now defaults to **hidden** until someone explicitly `@Expose()`s it. That's the strategy you want for any DTO that wraps a sensitive entity.

### `@Transform()`

Reshape a value on the way out: format dates, mask digits, derive fields.

```typescript
import { Controller, Get, Param } from "@nestjs/common";
import { plainToInstance, Transform } from "class-transformer";

export class UserDto {
  id: number;

  @Transform(({ value }) => value.toISOString())
  createdAt: Date;

  @Transform(({ value }) => `${value.slice(0, 2)}***${value.slice(-2)}`)
  apiKey: string;
}

@Controller("users")
export class UsersController {
  @Get(":id")
  findOne(@Param("id") id: string): UserDto {
    return plainToInstance(UserDto, {
      id: Number(id),
      createdAt: new Date("2025-01-15T09:30:00Z"),
      apiKey: "sk_live_abcdef1234567890",
    });
  }
}
```

`GET /users/1` returns:

```json
{
  "id": 1,
  "createdAt": "2025-01-15T09:30:00.000Z",
  "apiKey": "sk***90"
}
```

The `value` argument is the raw property; the function returns whatever should appear in the JSON.

## The class-instance gotcha

Those decorators only fire when the controller returns a **class instance** _or_ the route declares `@SerializeOptions({ type: ... })`. Return a plain object from a route with no `type` hint and the interceptor still runs `classToPlain(...)`, but `class-transformer` has no class metadata to consult, so every field passes through untouched ([`class-serializer.interceptor.ts:transformToPlain`](https://github.com/nestjs/nest/blob/master/packages/common/serializer/class-serializer.interceptor.ts) calls `classToPlain` unconditionally when `options.type` is unset; the no-op happens inside `class-transformer`, not in the guard).

```typescript
import { Controller, Get } from "@nestjs/common";
import { Exclude } from "class-transformer";

export class UserEntity {
  id: number;
  email: string;
  @Exclude() password: string;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}

@Controller("users")
export class UsersController {
  @Get("plain")
  leaks() {
    return { id: 1, email: "a@b.c", password: "secret" };
  }

  @Get("instance")
  safe(): UserEntity {
    return new UserEntity({ id: 1, email: "a@b.c", password: "secret" });
  }
}
```

`GET /users/plain` returns:

```json
{ "id": 1, "email": "a@b.c", "password": "secret" }
```

`GET /users/instance` returns:

```json
{ "id": 1, "email": "a@b.c" }
```

Same data, different type, very different blast radius.

### How your ORM affects this

The handler is free to use every field of a class instance: `user.password`, hash comparisons, audit logs all work. The stripping happens **after** `return`, when the interceptor calls `instanceToPlain(user)`. The trap: not every ORM gives you class instances. Behaviors below were verified against each library's own docs ([TypeORM `Repository.find`](https://typeorm.io/repository-api), [Prisma client output types](https://www.prisma.io/docs/orm/prisma-client/queries#queries-and-result-types), [Mongoose `.lean()`](https://mongoosejs.com/docs/tutorials/lean.html)).

| Source                                             | What you get back                | `@Exclude()` works? | Fix                                        |
| -------------------------------------------------- | -------------------------------- | :-----------------: | ------------------------------------------ |
| TypeORM `repository.findOne(...)` with `@Entity()` | Real `UserEntity` instance       |         ✅          | None needed                                |
| Prisma `prisma.user.findUnique(...)`               | Plain object (generated TS type) |         ❌          | `return plainToInstance(UserEntity, user)` |
| Mongoose `.lean()`                                 | Plain object                     |         ❌          | `return plainToInstance(UserEntity, doc)`  |
| Raw SQL via `dataSource.query(...)`                | Plain object                     |         ❌          | `return plainToInstance(UserEntity, row)`  |
| `fetch()` / external HTTP call                     | Plain object                     |         ❌          | `return plainToInstance(UserEntity, body)` |

Mental check: if `console.log(returned instanceof UserEntity)` would print `false` right before `return`, serialization is silently skipped. Wrap with `plainToInstance(UserEntity, raw)` (or `new UserEntity(raw)` if your constructor copies fields).

For arrays, map: `return rows.map((r) => plainToInstance(UserEntity, r))`.

## Role-based views with groups

`@Expose({ groups: [...] })` plus `@SerializeOptions({ groups: [...] })` on the route gives you per-role response shapes from a single entity.

```typescript
import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  SerializeOptions,
  UseInterceptors,
} from "@nestjs/common";
import { Exclude, Expose } from "class-transformer";

export class UserEntity {
  @Expose() id: number;
  @Expose() email: string;
  @Expose({ groups: ["admin"] }) role: string;
  @Expose({ groups: ["admin"] }) lastLoginIp: string;
  @Exclude() password: string;
}

@Controller("users")
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  @Get("me")
  @SerializeOptions({ groups: ["user"] })
  me(): UserEntity {
    return Object.assign(new UserEntity(), {
      id: 1,
      email: "a@b.c",
      role: "admin",
      lastLoginIp: "1.2.3.4",
      password: "secret",
    });
  }

  @Get("admin")
  @SerializeOptions({ groups: ["admin"] })
  asAdmin(): UserEntity {
    return Object.assign(new UserEntity(), {
      id: 1,
      email: "a@b.c",
      role: "admin",
      lastLoginIp: "1.2.3.4",
      password: "secret",
    });
  }
}
```

`/users/me` returns:

```json
{ "id": 1, "email": "a@b.c" }
```

`/users/admin` returns:

```json
{
  "id": 1,
  "email": "a@b.c",
  "role": "admin",
  "lastLoginIp": "1.2.3.4"
}
```

Same entity, two payloads, zero conditional code in the controller.

## Gotchas

> [!warning]- Plain objects skip the interceptor's strip step (unless you opt in)
> The most common bug, recapped here because it's how every leak in this recipe happens. If the controller returns a plain object literal (or anything not `instanceof YourEntity`), `ClassSerializerInterceptor` skips the `instanceToPlain` strip and every field reaches the wire. Either `return new Entity(...)` / `plainToInstance(Entity, raw)`, or annotate the route with `@SerializeOptions({ type: Entity })` so the interceptor converts the plain object before serializing. See [the class-instance gotcha](#the-class-instance-gotcha) for the ORM-specific cases.

> [!warning]- Nested objects need `@Type()` or their decorators don't run
> If a field is another class instance: `items: OrderItem[]`, `address: Address`: `class-transformer` needs `@Type(() => OrderItem)` on the field to know which class to apply decorators to. Without it, the nested object is treated as a plain bag and any `@Exclude()` / `@Expose()` on the nested class is silently ignored. Same leak shape as returning a plain object, one level deep.

> [!warning]- `@SerializeOptions()` is inert without `ClassSerializerInterceptor`
> Adding `@SerializeOptions({ groups: [...] })` to a route does nothing on its own. The metadata is only read by `ClassSerializerInterceptor`. Forget to register the interceptor (globally or via `@UseInterceptors`) and group-based views silently degrade to "no filtering": admin-only fields ship to every caller.

> [!info]- `reflect-metadata` must be imported before any decorator runs
> Required at the top of `main.ts`. Nest's CLI scaffolds this; the failure mode (a thrown error at startup) is loud, not silent, but worth knowing if you're hand-bootstrapping.

> [!info]- Decorating entities couples DB shape to API shape
> Mixing `@Exclude()` / `@Expose()` into a TypeORM or Prisma entity means renaming a column or splitting an entity ripples into your API contract. For non-trivial APIs, map entities to dedicated response DTOs and decorate the DTO. The recipe shows decorators on entities for brevity; production code usually shouldn't.

## See also

- [[nestjs/recipes/validation|Request validation with class-validator]]: the inbound twin: same `class-transformer`/`class-validator` pair, with the parallel `groups` mechanism for per-route rules.
- [[nestjs/fundamentals/interceptors|Interceptors]] for the interceptor pipeline and how `ClassSerializerInterceptor` plugs into it.
- [Official serialization docs](https://docs.nestjs.com/techniques/serialization)
- [`class-transformer` README](https://github.com/typestack/class-transformer)
