---
title: Validation with class-validator
aliases:
  [
    ValidationPipe,
    class-validator,
    DTO validation,
    validation groups,
    Request validation with class-validator,
  ]
tags: [type/recipe, tech/class-validator, tech/http]
area: nestjs
status: evergreen
related:
  - "[[nestjs/recipes/index]]"
  - "[[nestjs/recipes/serialization]]"
  - "[[nestjs/recipes/file-uploads]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/data/typeorm/handle-database-errors]]"
  - "[[nestjs/fundamentals/global-providers]]"
  - "[[nestjs/auth/jwt-strategy]]"
source:
  - https://docs.nestjs.com/techniques/validation
  - https://github.com/typestack/class-validator
  - https://github.com/typestack/class-transformer
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/validation.pipe.ts
---

> Validate request bodies, query params, and path params against DTO classes: declaratively, with one global pipe. The same `class-transformer`/`class-validator` pair powers [[nestjs/recipes/serialization|serialization]] on the way out and validation on the way in.

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
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

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

> [!warning]- Need DI in the pipe? Use `APP_PIPE` instead
> `app.useGlobalPipes(new ValidationPipe(...))` constructs the [[nestjs/fundamentals/pipes|pipe]] outside the container, so it can't inject providers (`ConfigService`, loggers, repositories) or run with request scope. The same applies to global [[nestjs/fundamentals/guards|guards]] and [[nestjs/fundamentals/interceptors|interceptors]]. When you need any of that, register through the matching `APP_*` token. See [[nestjs/fundamentals/global-providers|Global pipes, guards, interceptors, and filters via DI]] for the full comparison and worked examples.

## A first DTO

```ts
import { IsEmail, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

```ts
import { Body, Controller, Post } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";

@Controller("users")
export class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    return { ok: true, email: dto.email };
  }
}
```

`POST /users` with a valid body:

```json
{ "email": "a@b.c", "password": "hunter2!" }
```

```json
{ "ok": true, "email": "a@b.c" }
```

Same route with bad input:

```json
{ "email": "not-an-email", "password": "short" }
```

Returns `400 Bad Request`:

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

Nothing else to wire up.

## `whitelist` and `forbidNonWhitelisted`: the security pair

```ts
new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
```

- **`whitelist: true`**: silently strips properties that aren't decorated on the DTO.
- **`forbidNonWhitelisted: true`**: upgrades the silent strip to a `400`. Callers learn immediately that the field is unknown.

With `whitelist: true` only, this request:

```json
{ "email": "a@b.c", "password": "hunter2!", "isAdmin": true }
```

Arrives at the handler as:

```json
{ "email": "a@b.c", "password": "hunter2!" }
```

Add `forbidNonWhitelisted: true` and the same request fails fast:

```json
{
  "statusCode": 400,
  "message": ["property isAdmin should not exist"],
  "error": "Bad Request"
}
```

Use both in production. Strip-only is fine for migrations where old clients still send deprecated fields you want to ignore.

> [!warning]- Without `whitelist`, mass-assignment is a real bug
> `Object.assign(user, dto)` on a DTO that wasn't whitelisted is how `isAdmin: true` ends up in your DB. The pipe defaults to letting unknown fields through: flip the switch.

## `transform: true`: DTOs become real class instances

By default, `@Body() dto: CreateUserDto` is a **plain object** that just happens to satisfy the type at compile time. With `transform: true`, the pipe runs `plainToInstance(CreateUserDto, body)` so `dto instanceof CreateUserDto` is true and any methods on the DTO actually work.

```ts
import { IsString, MinLength } from "class-validator";

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

Without `transform: true`, calling `dto.fullName()` throws `dto.fullName is not a function`:

```text
TypeError: dto.fullName is not a function
    at UsersController.create (.../users.controller.ts:12:22)
```

With `transform: true`, the same handler returns:

```json
{ "fullName": "Ada Lovelace" }
```

### Where the pipe actually instantiates a class

The pipe inspects the **metatype** of the parameter (the TS type Nest reflects from your handler signature). Validation only runs when the metatype is a custom class; for built-in primitives, validation is skipped but `transform: true` still coerces single-key path/query params via `transformPrimitive` ([source: `validation.pipe.ts` `transformPrimitive`](https://github.com/nestjs/nest/blob/master/packages/common/pipes/validation.pipe.ts#L172-L201)).

| Parameter signature                         | Metatype          | Validation runs? | `transform: true` produces                                                           |
| ------------------------------------------- | ----------------- | :--------------: | ------------------------------------------------------------------------------------ |
| `@Body() dto: CreateUserDto`                | `CreateUserDto`   |        ✅        | `CreateUserDto` instance                                                             |
| `@Query() q: PaginationQuery`               | `PaginationQuery` |        ✅        | `PaginationQuery` instance (whole-object query needs `enableImplicitConversion`)     |
| `@Param() p: GetUserParams`                 | `GetUserParams`   |        ✅        | `GetUserParams` instance                                                             |
| `@Body() raw: object`                       | `Object`          |        ❌        | The raw POJO from `body-parser` (no coercion: `transformPrimitive` skips bodies)     |
| `@Param('id') id: string`                   | `String`          |        ❌        | `String(value)` (URL params are already strings, so no visible change)               |
| `@Query('page') page: number`               | `Number`          |        ❌        | Coerced via `+value`: `?page=2` arrives as the number `2`                            |
| `@Query('active') active: boolean`          | `Boolean`         |        ❌        | Coerced via `value === true \|\| value === 'true'`: only `'true'` arrives as `true`  |
| `@UploadedFile() file: Express.Multer.File` | `Object`          |        ❌        | The raw [[nestjs/recipes/file-uploads\|multer]] file (validate with `ParseFilePipe`) |

`ParseIntPipe` / `ParseBoolPipe` (see [[nestjs/fundamentals/pipes|Pipes]]) still have a place: they throw a 400 on bad input, while `ValidationPipe`'s `transformPrimitive` silently coerces (`+value` returns `NaN` for `?page=abc` and the handler sees `NaN`).

### `enableImplicitConversion: true`

Whole-object query/body params (`@Query() q: PaginationQuery` with no key) bypass `transformPrimitive` and go through `plainToInstance` instead. Without `enableImplicitConversion`, every nested field arrives as a string from `qs`:

```ts
import { IsInt, Max, Min } from "class-validator";

export class PaginationQuery {
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;
}
```

`GET /items?limit=10` → with `enableImplicitConversion: true`, `limit` is the number `10`. Without it, `@IsInt()` fails because `"10"` is a string.

> [!info]- Implicit conversion uses class-transformer rules
> `enableImplicitConversion` is forwarded to [`class-transformer`'s `plainToInstance`](https://github.com/typestack/class-transformer#enableimplicitconversion-option) and uses TS reflected types to coerce. Boolean coercion in particular is loose enough to surprise: pair with explicit `@Transform(({ value }) => value === 'true')` for fields where strict parsing matters.

## Validation groups: same DTO, different rules per route

This is the parallel to `class-transformer` groups in the [[nestjs/recipes/serialization#Role-based views with groups|serialization recipe]]. Same pattern, different library: serialization groups pick which fields **leave**, validation groups pick which rules **run**.

A real case: on `POST /users`, password is required. On `PATCH /users/:id`, the user is updating their profile and shouldn't have to re-send the password.

```ts
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UserDto {
  @IsEmail({}, { groups: ["create", "update"] })
  email: string;

  @IsString({ groups: ["create"] })
  @MinLength(8, { groups: ["create"] })
  @IsOptional({ groups: ["update"] })
  password?: string;
}
```

Tell the pipe which group to apply per route:

```ts
import { Body, Controller, Patch, Post, UsePipes, ValidationPipe } from "@nestjs/common";
import { UserDto } from "./dto/user.dto";

@Controller("users")
export class UsersController {
  @Post()
  @UsePipes(new ValidationPipe({ groups: ["create"], whitelist: true }))
  create(@Body() dto: UserDto) {
    return dto;
  }

  @Patch(":id")
  @UsePipes(new ValidationPipe({ groups: ["update"], whitelist: true }))
  update(@Body() dto: UserDto) {
    return dto;
  }
}
```

`POST /users` without a password fails:

```json
{ "email": "a@b.c" }
```

```json
{
  "statusCode": 400,
  "message": ["password must be longer than or equal to 8 characters", "password must be a string"],
  "error": "Bad Request"
}
```

`PATCH /users/1` with the same body passes: the `update` group only requires `email`:

```json
{ "email": "a@b.c" }
```

```json
{ "email": "a@b.c" }
```

> [!info]- Always pass `always: true` if some decorators have no group
> A decorator without `groups` runs **only when no group is set** by default. Set `always: true` on the pipe (or `always: true` on the decorator) to keep ungrouped rules running alongside grouped ones.

## Nested objects and arrays

Decorators don't recurse automatically. You need `@ValidateNested()` to descend, plus `@Type()` from `class-transformer` so the pipe knows which class to instantiate inside arrays.

```ts
import { Type } from "class-transformer";
import { IsArray, IsString, MinLength, ValidateNested } from "class-validator";

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
import { registerDecorator, ValidationOptions } from "class-validator";

export function IsSlug(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isSlug",
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return typeof value === "string" && /^[a-z0-9-]+$/.test(value);
        },
        defaultMessage: () => `${propertyName} must be lowercase letters, digits, and dashes only`,
      },
    });
  };
}
```

```ts
import { IsSlug } from "./validators/is-slug.validator";

export class CreatePostDto {
  @IsSlug()
  slug: string;
}
```

For async rules that need DI (e.g., "is this email already taken?"), use `ValidatorConstraint` with `{ async: true }` and register the constraint class as a provider: see the [class-validator docs](https://github.com/typestack/class-validator#custom-validation-classes).

## Customizing the error response

Default error shape is fine for a frontend you control. For a public API, shape it yourself:

```ts
import { BadRequestException, ValidationError, ValidationPipe } from "@nestjs/common";

new ValidationPipe({
  exceptionFactory: (errors: ValidationError[]) =>
    new BadRequestException({
      statusCode: 400,
      error: "Validation failed",
      details: errors.map((e) => ({
        field: e.property,
        messages: Object.values(e.constraints ?? {}),
      })),
    }),
});
```

In production, also set `disableErrorMessages: true` if you don't want the raw constraint strings reaching the client (and instead return your own copy).

## See also

- [[nestjs/fundamentals/pipes|Pipes fundamentals]]: `ValidationPipe` options table and binding scopes
- [[nestjs/recipes/serialization|Response serialization]]: the `class-transformer` side of the same pair, including the parallel `groups` mechanism
- [Validation docs](https://docs.nestjs.com/techniques/validation)
- [class-validator decorators reference](https://github.com/typestack/class-validator#validation-decorators)
