---
title: Request validation with class-validator
aliases: [ValidationPipe, class-validator, DTO validation, validation groups]
tags: [type/recipe, tech/class-validator, tech/http]
area: nestjs
status: evergreen
related:
  - "[[nestjs/recipes/index]]"
  - "[[nestjs/recipes/serialization]]"
  - "[[nestjs/recipes/file-uploads]]"
  - "[[nestjs/fundamentals/pipes]]"
source:
  - https://docs.nestjs.com/techniques/validation
  - https://github.com/typestack/class-validator
---

> Validate request bodies, query params, and path params against DTO classes — declaratively, with one global pipe. The same `class-transformer`/`class-validator` pair powers serialization on the way out (see [[nestjs/recipes/serialization|the serialization recipe]]) and validation on the way in.

## When to reach for it

The moment a controller does `body.email.toLowerCase()` and you realize nothing guarantees `body.email` is a string. Other cases:

- Reject unknown fields so callers can't slip past business rules by adding `isAdmin: true` to a registration payload.
- Coerce `?page=2` (string) to a `number` for pagination handlers.
- Run different rules for the same DTO depending on context (create vs. update, public vs. admin).

## Setup

```shell
npm i class-validator class-transformer
```

Bind globally in `main.ts` so every controller is covered:

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.listen(3000);
}
bootstrap();
```

Those four options are the **secure default**. Each one earns its keep below.

## A first DTO

```ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    return { ok: true, email: dto.email };
  }
}
```

`POST /users` with `{ email: "not-an-email", password: "short" }` returns `400` with both messages. Nothing else to wire up.

## `whitelist` and `forbidNonWhitelisted` — the security pair

```ts
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
```

- **`whitelist: true`** — silently strips properties that aren't decorated on the DTO. `{ email, password, isAdmin: true }` arrives at the handler as `{ email, password }`.
- **`forbidNonWhitelisted: true`** — upgrades the silent strip to a `400`. Callers learn immediately that the field is unknown.

Use both in production. Strip-only is fine for migrations where old clients still send deprecated fields you want to ignore.

> [!warning]- Without `whitelist`, mass-assignment is a real bug
> `Object.assign(user, dto)` on a DTO that wasn't whitelisted is how `isAdmin: true` ends up in your DB. The pipe defaults to letting unknown fields through — flip the switch.

## `transform: true` — DTOs become real class instances

By default, `@Body() dto: CreateUserDto` is a **plain object** that just happens to satisfy the type at compile time. With `transform: true`, the pipe runs `plainToInstance(CreateUserDto, body)` so `dto instanceof CreateUserDto` is true and any methods on the DTO actually work.

```ts
import { IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
```

Without `transform: true`, calling `dto.fullName()` throws `dto.fullName is not a function`.

### `enableImplicitConversion: true`

Path/query params arrive as strings. With implicit conversion on, the pipe coerces based on the TS type:

```ts
import { IsInt, Max, Min } from 'class-validator';

export class PaginationQuery {
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;
}
```

`GET /items?limit=10` → `limit` is the number `10`, not the string `"10"`. Without it, `@IsInt()` fails because `"10"` is a string.

> [!warning]- Implicit conversion can mask bad input
> `enableImplicitConversion` will turn `?active=anything` into `true` for a `boolean` field. Pair with explicit decorators (`@IsBoolean()`, `@Transform(({ value }) => value === 'true')`) for fields where loose coercion would hurt.

## Validation groups — same DTO, different rules per route

This is the parallel to `class-transformer` groups in the [[nestjs/recipes/serialization#Groups for role-based payloads|serialization recipe]]. Same pattern, different library: serialization groups pick which fields **leave**, validation groups pick which rules **run**.

A real case: on `POST /users`, password is required. On `PATCH /users/:id`, the user is updating their profile and shouldn't have to re-send the password.

```ts
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UserDto {
  @IsEmail({}, { groups: ['create', 'update'] })
  email: string;

  @IsString({ groups: ['create'] })
  @MinLength(8, { groups: ['create'] })
  @IsOptional({ groups: ['update'] })
  password?: string;
}
```

Tell the pipe which group to apply per route:

```ts
import { Body, Controller, Patch, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { UserDto } from './dto/user.dto';

@Controller('users')
export class UsersController {
  @Post()
  @UsePipes(new ValidationPipe({ groups: ['create'], whitelist: true }))
  create(@Body() dto: UserDto) {
    return dto;
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ groups: ['update'], whitelist: true }))
  update(@Body() dto: UserDto) {
    return dto;
  }
}
```

> [!tip]- Always pass `always: true` if some decorators have no group
> A decorator without `groups` runs **only when no group is set** by default. Set `always: true` on the pipe (or `always: true` on the decorator) to keep ungrouped rules running alongside grouped ones.

## Nested objects and arrays

Decorators don't recurse automatically. You need `@ValidateNested()` to descend, plus `@Type()` from `class-transformer` so the pipe knows which class to instantiate inside arrays.

```ts
import { Type } from 'class-transformer';
import { IsArray, IsString, MinLength, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsString()
  sku: string;

  @IsString()
  @MinLength(1)
  quantity: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
```

Without `@Type()`, items stay as plain objects and their decorators never run.

## Custom validators

When the built-ins aren't enough, write your own. For a sync rule, a function-style decorator is the lightest:

```ts
import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsSlug(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSlug',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && /^[a-z0-9-]+$/.test(value);
        },
        defaultMessage: () => `${propertyName} must be lowercase letters, digits, and dashes only`,
      },
    });
  };
}
```

```ts
import { IsSlug } from './validators/is-slug.validator';

export class CreatePostDto {
  @IsSlug()
  slug: string;
}
```

For async rules that need DI (e.g., "is this email already taken?"), use `ValidatorConstraint` with `{ async: true }` and register the constraint class as a provider — see the [class-validator docs](https://github.com/typestack/class-validator#custom-validation-classes).

## Customizing the error response

Default error shape is fine for a frontend you control. For a public API, shape it yourself:

```ts
import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

new ValidationPipe({
  exceptionFactory: (errors: ValidationError[]) =>
    new BadRequestException({
      statusCode: 400,
      error: 'Validation failed',
      details: errors.map((e) => ({
        field: e.property,
        messages: Object.values(e.constraints ?? {}),
      })),
    }),
});
```

In production, also set `disableErrorMessages: true` if you don't want the raw constraint strings reaching the client (and instead return your own copy).

## See also

- [[nestjs/fundamentals/pipes|Pipes fundamentals]] — `ValidationPipe` options table and binding scopes
- [[nestjs/recipes/serialization|Response serialization]] — the `class-transformer` side of the same pair, including the parallel `groups` mechanism
- [Validation docs](https://docs.nestjs.com/techniques/validation)
- [class-validator decorators reference](https://github.com/typestack/class-validator#validation-decorators)
