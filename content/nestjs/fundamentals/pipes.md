---
title: Pipes
aliases: [validation pipe, transform pipe]
tags: [type/concept, lifecycle, validation]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/recipes/file-uploads]]"
  - "[[nestjs/recipes/serialization]]"
  - "[[nestjs/recipes/validation]]"
source:
  - https://docs.nestjs.com/pipes
  - https://docs.nestjs.com/techniques/validation
  - https://github.com/nestjs/nest/tree/master/packages/common/pipes
  - https://github.com/typestack/class-validator
  - https://github.com/typestack/class-transformer
---

> Transform or validate input data **before** it reaches the route handler.

## Signature

```typescript
import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common"

@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed)) throw new BadRequestException()
    return parsed
  }
}
```

## Built-in pipes

All exported from `@nestjs/common`.

| Pipe               | Purpose                                                      | Notes                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ValidationPipe`   | [[nestjs/recipes/validation\|DTO validation]]/transformation | Uses `class-validator` + `class-transformer` (peer deps you install)                                                                                              |
| `ParseIntPipe`     | string → integer                                             | Regex `^-?\d+$`. Throws `BadRequestException` by default                                                                                                          |
| `ParseFloatPipe`   | string → float                                               | `parseFloat` + `isFinite` check                                                                                                                                   |
| `ParseBoolPipe`    | `"true"`/`"false"` → boolean                                 | Only those two strings (or actual booleans) pass                                                                                                                  |
| `ParseArrayPipe`   | string → array                                               | Default separator `,`. Wraps a `ValidationPipe({ transform: true })` to coerce items                                                                              |
| `ParseUUIDPipe`    | UUID string validation                                       | `version?: '3' \| '4' \| '5' \| '7'` (default: any version)                                                                                                       |
| `ParseEnumPipe`    | enum membership check                                        | Constructor requires the enum                                                                                                                                     |
| `ParseDatePipe`    | string/number → `Date`                                       | `new Date(value)`; supports `default: () => Date`                                                                                                                 |
| `DefaultValuePipe` | fallback when nil                                            | Returns default when value is `null`, `undefined`, or `NaN`                                                                                                       |
| `ParseFilePipe`    | upload validation                                            | Compose `MaxFileSizeValidator` + `FileTypeValidator` directly, or use the fluent `ParseFilePipeBuilder`. See [[nestjs/recipes/file-uploads\|File uploads recipe]] |

> [!info] Common options across `Parse*` pipes
> Each `Parse*` constructor accepts an options object with:
>
> - `errorHttpStatusCode` — override the default `400` status.
> - `exceptionFactory: (error: string) => any` — return a custom exception.
> - `optional: boolean` — when `true`, nil values pass through instead of throwing.

## Binding

| Scope      | How                                               |
| ---------- | ------------------------------------------------- |
| Global     | `app.useGlobalPipes()` or the `APP_PIPE` provider |
| Controller | `@UsePipes()` on the class                        |
| Route      | `@UsePipes()` on the method                       |
| Param      | `@Body(new ValidationPipe())`                     |

## Order: the param level reversal

Standard order is global, controller, route. But at the **route parameter level**, pipes run from the **last parameter to the first**:

```typescript
import { Body, Controller, Param, Patch, Query, UsePipes } from "@nestjs/common"

@UsePipes(GeneralValidationPipe)
@Controller("cats")
export class CatsController {
  @UsePipes(RouteSpecificPipe)
  @Patch(":id")
  updateCat(
    @Body() body: UpdateCatDTO,
    @Param() params: UpdateCatParams,
    @Query() query: UpdateCatQuery,
  ) {}
}
// GeneralValidationPipe runs on: query, then params, then body.
// Then RouteSpecificPipe runs in the same reversed order.
```

## DefaultValuePipe

Returns its constructor argument when the incoming value is `null`, `undefined`, or `NaN`. **Order matters** when chaining:

```typescript
import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from "@nestjs/common"

@Controller("cats")
export class CatsController {
  @Get()
  list(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("size", new DefaultValuePipe(10), ParseIntPipe) size: number,
  ) {}
}
```

`DefaultValuePipe` runs **first** so `ParseIntPipe` receives a number, not `undefined`. Reverse the order and `ParseIntPipe` would throw on missing query params.

> [!warning] What "missing" means
> The default kicks in for `null`, `undefined`, and `NaN`. An **empty string** (`?page=`) is **not** nil, so it passes through and `ParseIntPipe` will throw. If you need to treat empty strings as missing, normalize upstream (e.g., a custom pipe).

## ValidationPipe

> [!info] Deep dive lives in the [[nestjs/recipes/validation|validation recipe]]
> This section is a reference for the option flags. For end-to-end DTO patterns — global setup, `whitelist`, `transform`, validation groups, nested objects, custom validators, `exceptionFactory` — see the recipe.

Install peer deps:

```bash
npm i class-validator class-transformer
```

### Built-in options (from `ValidationPipeOptions`)

| Option                     | Type                                 | What it does                                                                                                                          |
| -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `transform`                | `boolean`                            | Run `class-transformer` to instantiate DTO classes from plain objects. Required if you want primitives coerced or DTO methods to work |
| `transformOptions`         | `ClassTransformOptions`              | Forwarded to `class-transformer`. Common: `enableImplicitConversion: true` to coerce strings → number/boolean based on TS types       |
| `disableErrorMessages`     | `boolean`                            | Hide validation messages in the response (use in production)                                                                          |
| `errorHttpStatusCode`      | `number`                             | Override `400` default (e.g., `422`)                                                                                                  |
| `exceptionFactory`         | `(errors: ValidationError[]) => any` | Custom exception shape                                                                                                                |
| `validateCustomDecorators` | `boolean`                            | Validate args from custom param decorators too                                                                                        |
| `expectedType`             | `Type<any>`                          | Force the type to validate against (overrides metatype)                                                                               |

### Inherited `class-validator` options (subset)

| Option                  | What it does                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `whitelist`             | Strip properties without validation decorators                                                                                                                            |
| `forbidNonWhitelisted`  | Throw instead of stripping                                                                                                                                                |
| `forbidUnknownValues`   | Reject unknown objects (Nest sets default to `false`, [issue #10683](https://github.com/nestjs/nest/issues/10683))                                                        |
| `skipMissingProperties` | Skip validation for null/undefined props                                                                                                                                  |
| `stopAtFirstError`      | Stop at the first failing decorator per property                                                                                                                          |
| `groups`                | Validation groups — same DTO, different rules per route. See [[nestjs/recipes/validation#Validation groups — same DTO, different rules per route\|the validation recipe]] |
| `errorFormat`           | `'list'` (default) or `'grouped'`                                                                                                                                         |

Full table: [Validation docs](https://docs.nestjs.com/techniques/validation).

> [!example]- Recommended global setup
>
> ```typescript
> app.useGlobalPipes(
>   new ValidationPipe({
>     whitelist: true,
>     forbidNonWhitelisted: true,
>     transform: true,
>     transformOptions: { enableImplicitConversion: true },
>   }),
> )
> ```

> [!warning]- `transform: true` mutates request shape
> With `transform: true`, the value your handler receives is a **DTO class instance**, not the raw `req.body`. If you log/serialize it elsewhere assuming the original shape, you may see unexpected fields stripped (when `whitelist` is on) or types coerced. This is intentional but easy to miss.

> [!tip]- Class vs. instance binding
> `@UsePipes(ValidationPipe)` lets Nest instantiate the pipe (DI works, no options).
> `@UsePipes(new ValidationPipe({ whitelist: true }))` gives you options but loses DI for that instance.

## Alternative: Zod

`zod` is not built into Nest, but the official docs include a [Zod-based custom pipe example](https://docs.nestjs.com/pipes#object-schema-validation).

> [!example]- Minimal Zod pipe
>
> ```typescript
> import { PipeTransform, BadRequestException } from "@nestjs/common"
> import { ZodSchema } from "zod"
>
> export class ZodValidationPipe implements PipeTransform {
>   constructor(private schema: ZodSchema) {}
>
>   transform(value: unknown) {
>     const parsed = this.schema.safeParse(value)
>     if (!parsed.success) throw new BadRequestException(parsed.error.format())
>     return parsed.data
>   }
> }
> ```
>
> Bind per param: `@Body(new ZodValidationPipe(createUserSchema))`. Source: [zod](https://github.com/colinhacks/zod), [Nest docs example](https://docs.nestjs.com/pipes#object-schema-validation).

## Common errors

| Symptom                                 | Likely cause                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| DTO instance methods are `undefined`    | Missing `transform: true` — you got a plain object                                                               |
| Numbers arrive as strings               | Add `transformOptions: { enableImplicitConversion: true }` or use `@Type(() => Number)` from `class-transformer` |
| Extra fields appear in DTO              | Enable `whitelist: true` to strip them                                                                           |
| Validation always passes                | Pipe not bound globally, or DTO class lacks decorators                                                           |
| `ParseIntPipe` throws on optional param | Either provide a `DefaultValuePipe` first, or pass `{ optional: true }` to `ParseIntPipe`                        |

> [!warning]- `enableImplicitConversion` does not handle every type
> [`class-transformer`](https://github.com/typestack/class-transformer/blob/develop/src/TransformOperationExecutor.ts) implicit conversion only triggers in `plain → class` direction, reads `Reflect.getMetadata('design:type', ...)` (so the property needs at least one decorator), and only knows how to convert `String`, `Number`, `Boolean`, `Date`, `Buffer`. Practical matrix:
>
> | Property type                               | Implicit conversion                                    | Need `@Type()`?                                                                                                                  |
> | ------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
> | `string`, `number`, `boolean`, `Date`       | ✅ enough                                              | ❌                                                                                                                               |
> | Branded type (`string & { __brand: 'Id' }`) | ✅ converts as base (`String`)                         | ❌ — but the brand is **compile-time only**, no runtime guarantee. Add `@IsUUID()`, regex, or a custom validator if you need it. |
> | Nested class (no circular imports)          | ⚠️ sometimes                                           | ✅ recommended always                                                                                                            |
> | Array of classes (`items: Item[]`)          | ❌ TS emits `design:type = Array` with no element info | ✅ **required** — `@Type(() => Item)`                                                                                            |
> | `interface` / structural type               | ❌ emits `design:type = Object`, stays as plain object | ✅ use a real class                                                                                                              |
>
> Rule of thumb: implicit conversion is a primitive-coercion shortcut, not a substitute for `@Type()` on anything object-shaped.

> [!warning]- Arrays of classes need both `@Type()` and `@ValidateNested({ each: true })`
> The `Item[]` in TypeScript is invisible at runtime — class-transformer reads `Array.isArray(value)` and applies whatever `@Type()` says to **each element**. Without `@Type()`, elements stay as plain objects. Without `@ValidateNested({ each: true })` from [`class-validator`](https://github.com/typestack/class-validator#validating-nested-objects), the decorators inside `Item` (`@IsString()`, `@IsInt()`, etc.) **are not executed** on the children — silent pass.
>
> ```ts
> import { Type } from "class-transformer"
> import { ValidateNested, IsString } from "class-validator"
>
> class Item {
>   @IsString()
>   name: string
> }
>
> export class CreatePostDto {
>   @ValidateNested({ each: true })
>   @Type(() => Item)
>   items: Item[]
> }
> ```
>
> | Setup                                  | `items` becomes           | Children validated?                             |
> | -------------------------------------- | ------------------------- | ----------------------------------------------- |
> | nothing                                | array of plain objects    | ❌                                              |
> | `@Type(() => Item)` only               | array of `Item` instances | ❌ — `@IsString()` inside `Item` never runs     |
> | `@ValidateNested({ each: true })` only | array of plain objects    | ❌ — validator has no class to validate against |
> | both                                   | array of `Item` instances | ✅                                              |
>
> Same combo applies to single nested objects (`item: Item` → `@ValidateNested()` without `each`). See [`class-transformer`](https://github.com/typestack/class-transformer/blob/develop/src/TransformOperationExecutor.ts) and the [class-validator nested objects docs](https://github.com/typestack/class-validator#validating-nested-objects).

## When to reach for it

- DTO validation with `class-validator` and `ValidationPipe`.
- String to number or string to UUID coercion.
- Trim, lowercase, normalize input shape.

## See also

- [[request-lifecycle|Request lifecycle hub]]
- [[nestjs/recipes/file-uploads|File uploads recipe (ParseFilePipe in action)]]
