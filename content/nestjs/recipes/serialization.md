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

`class-transformer` is a peer dep of `@nestjs/common`'s serializer. `reflect-metadata` is already required by Nest itself.

## Wire up the interceptor

Bind it globally so every endpoint runs through the serializer. No more `@UseInterceptors(ClassSerializerInterceptor)` per controller.

```typescript
import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) =>
        new ClassSerializerInterceptor(reflector),
      inject: [Reflector],
    },
  ],
})
export class AppModule {}
```

Why the factory: `ClassSerializerInterceptor` needs `Reflector` to read `@SerializeOptions()` metadata. The shorthand `{ provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor }` works too because Nest resolves the constructor deps automatically; the factory form is explicit and survives if you ever wrap or extend the interceptor.

## The class-instance gotcha

The interceptor only acts on **class instances**. If your controller returns a plain object, serialization is silently skipped and every field leaks.

```typescript
import { Controller, Get } from '@nestjs/common';
import { Exclude } from 'class-transformer';

export class UserEntity {
  id: number;
  email: string;
  @Exclude() password: string;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}

@Controller('users')
export class UsersController {
  @Get('plain')
  leaks() {
    return { id: 1, email: 'a@b.c', password: 'secret' }; // password leaks
  }

  @Get('instance')
  safe(): UserEntity {
    return new UserEntity({ id: 1, email: 'a@b.c', password: 'secret' });
  }
}
```

`/users/plain` returns `{ id, email, password }`. `/users/instance` returns `{ id, email }`. Same data, different type, very different blast radius.

If your ORM hands you POJOs (raw query results, `.lean()` in Mongoose), wrap them: `return rows.map((r) => new UserEntity(r))`.

## The decorators

### `@Exclude()`

Drops the field from the response. Apply per-property or at class level.

```typescript
import { Exclude } from 'class-transformer';

export class UserEntity {
  id: number;
  email: string;
  @Exclude() password: string;
  @Exclude() passwordResetToken: string;
}
```

### `@Expose()` and `excludeAll` strategy

Flip the default: hide everything, then opt fields in. Safer for accidental leaks when you add a new column to the entity.

```typescript
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserDto {
  @Expose() id: number;
  @Expose() email: string;
  passwordHash: string; // not @Expose()'d, so excluded
  internalNote: string; // same
}
```

Adding a new column to the entity now defaults to **hidden** until someone explicitly `@Expose()`s it. That's the strategy you want for any DTO that wraps a sensitive entity.

### `@Transform()`

Reshape a value on the way out: format dates, mask digits, derive fields.

```typescript
import { Transform } from 'class-transformer';

export class UserDto {
  @Transform(({ value }) => value.toISOString())
  createdAt: Date;

  @Transform(({ value }) => `${value.slice(0, 2)}***${value.slice(-2)}`)
  apiKey: string;
}
```

The `value` is the raw property; the function returns whatever should appear in the JSON.

## Role-based views with groups

`@Expose({ groups: [...] })` plus `@SerializeOptions({ groups: [...] })` on the route gives you per-role response shapes from a single entity.

```typescript
import { ClassSerializerInterceptor, Controller, Get, SerializeOptions, UseInterceptors } from '@nestjs/common';
import { Exclude, Expose } from 'class-transformer';

export class UserEntity {
  @Expose() id: number;
  @Expose() email: string;
  @Expose({ groups: ['admin'] }) role: string;
  @Expose({ groups: ['admin'] }) lastLoginIp: string;
  @Exclude() password: string;
}

@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  @Get('me')
  @SerializeOptions({ groups: ['user'] })
  me(): UserEntity {
    return Object.assign(new UserEntity(), { id: 1, email: 'a@b.c', role: 'admin', lastLoginIp: '1.2.3.4', password: 'secret' });
  }

  @Get('admin')
  @SerializeOptions({ groups: ['admin'] })
  asAdmin(): UserEntity {
    return Object.assign(new UserEntity(), { id: 1, email: 'a@b.c', role: 'admin', lastLoginIp: '1.2.3.4', password: 'secret' });
  }
}
```

`/users/me` returns `{ id, email }`. `/users/admin` returns `{ id, email, role, lastLoginIp }`. Same entity, two payloads, zero conditional code in the controller.

## Gotchas

- **Plain objects skip the interceptor.** The most common bug. Always return `new Entity(...)`.
- **Nested objects need `@Type()`.** If a field is an array of another class (`@Type(() => OrderItem) items: OrderItem[]`), `class-transformer` needs the explicit type to apply the right decorators recursively.
- **`reflect-metadata` import order.** It must be imported once at the top of `main.ts` before any decorator runs. Nest's CLI scaffolds this for you.
- **`@SerializeOptions()` only works when the interceptor is bound.** Setting it without `ClassSerializerInterceptor` registered does nothing.
- **DTOs vs entities.** Mixing serialization decorators into a TypeORM/Prisma entity couples DB shape to API shape. For non-trivial APIs, map entities to dedicated DTOs and decorate the DTO instead.

## See also

- [[nestjs/recipes/validation|Request validation with class-validator]] — the inbound twin: same `class-transformer`/`class-validator` pair, with the parallel `groups` mechanism for per-route rules.
- [[nestjs/fundamentals/interceptors|Interceptors]] for the interceptor lifecycle and how `ClassSerializerInterceptor` plugs into it.
- [Official serialization docs](https://docs.nestjs.com/techniques/serialization)
- [`class-transformer` README](https://github.com/typestack/class-transformer)
