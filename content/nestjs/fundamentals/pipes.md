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
  - "[[nestjs/recipes/trace-id]]"
  - "[[nestjs/recipes/validation]]"
  - "[[nestjs/fundamentals/global-providers]]"
  - "[[nestjs/auth/jwt-strategy]]"
  - "[[nestjs/data/typeorm/handle-database-errors]]"
source:
  - https://docs.nestjs.com/pipes
  - https://docs.nestjs.com/techniques/validation
  - https://docs.nestjs.com/cli/usages
  - https://github.com/nestjs/nest/tree/master/packages/common/pipes
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-uuid.pipe.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-int.pipe.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-bool.pipe.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-float.pipe.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-date.pipe.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-array.pipe.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/default-value.pipe.ts
  - https://github.com/nestjs/nest/blob/master/packages/common/pipes/validation.pipe.ts
  - https://github.com/nestjs/nest/blob/master/packages/core/pipes/pipes-consumer.ts
  - https://github.com/nestjs/nest/blob/master/packages/core/router/router-execution-context.ts
  - https://github.com/nestjs/nest-cli/blob/master/actions/generate.action.ts
  - https://github.com/nestjs/nest-cli/blob/master/commands/generate.command.ts
  - https://github.com/typestack/class-validator
  - https://github.com/typestack/class-transformer
  - https://github.com/nestjs/schematics/blob/master/src/lib/pipe/schema.json
  - https://github.com/typestack/class-transformer/blob/develop/src/TransformOperationExecutor.ts
---

> Transform or validate input data **before** it reaches the route handler.

## Signature

```typescript
import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) throw new BadRequestException();
    return parsed;
  }
}
```

## Generate with the CLI

```bash
nest generate pipe parse-int   # full form
nest g pi parse-int            # short alias → src/parse-int/parse-int.pipe.ts
nest g pi parse-int --flat     # no wrapping folder → src/parse-int.pipe.ts
nest g pi common/trim          # nested path → src/common/trim/trim.pipe.ts
nest g pi common/trim --flat   # nested + flat → src/common/trim.pipe.ts
nest g pi parse-int --no-spec  # skip the *.spec.ts test file
nest g pi parse-int --dry-run  # preview the file plan, write nothing
```

Creates `<name>.pipe.ts` (and `<name>.pipe.spec.ts` unless `--no-spec`). The `nest` CLI wraps the file in a folder named after the element by default; pass `--flat` to drop it directly in the target path. Verify any path with `--dry-run`: the [pipe schematic schema defaults `flat` to `true`](https://github.com/nestjs/schematics/blob/master/src/lib/pipe/schema.json#L31) (same for `guard`, `interceptor`, `filter`), but [`@nestjs/cli` always passes the CLI flag's value to the schematic](https://github.com/nestjs/nest-cli/blob/master/actions/generate.action.ts#L59) (`!!flat?.value`, which is `false` when `--flat` is absent), overriding the schema default. The runtime default is folder-wrapped output regardless of the schema file.

## Why a pipe, not [[nestjs/fundamentals/middleware|middleware]] / [[nestjs/fundamentals/guards|a guard]] / [[nestjs/fundamentals/interceptors|an interceptor]]

- **Per-argument scope**: a pipe receives **one** handler argument (`@Body()`, `@Query('id')`, …) plus its `metatype`, not the full `Request`. That is what makes `ValidationPipe` automatic: it looks up the DTO class from the metatype and runs `class-validator` against just that value.
- **Transform or reject**: return a value to pass it on (optionally coerced/sanitized), throw to reject with `400 BadRequestException` by default. There is no `next()`, no response stream, no `Observable`.
- **Wrong layer for other jobs**: authorization belongs in [[nestjs/fundamentals/guards|a guard]] (boolean decision, `403`); wrapping or timing belongs in [[nestjs/fundamentals/interceptors|an interceptor]] (sees the response); request-shape mutation across many routes belongs in [[nestjs/fundamentals/middleware|middleware]] (handler args don't exist there yet).

Source: [Pipes intro](https://docs.nestjs.com/pipes).

## Built-in pipes

All exported from `@nestjs/common`.

| Pipe               | Purpose                                                      | Notes                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ValidationPipe`   | [[nestjs/recipes/validation\|DTO validation]]/transformation | Uses `class-validator` + `class-transformer` (peer deps you install)                                                                                                                                                                                                                                                              |
| `ParseIntPipe`     | string → integer                                             | Regex `^-?\d+$`. Throws `BadRequestException` by default. See [composing pipes](#common-recipes)                                                                                                                                                                                                                                  |
| `ParseFloatPipe`   | string → float                                               | [`parseFloat` after an `isFinite(value)` guard](https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-float.pipe.ts)                                                                                                                                                                                             |
| `ParseBoolPipe`    | `"true"`/`"false"` → boolean                                 | Only those two strings (or actual booleans) pass                                                                                                                                                                                                                                                                                  |
| `ParseArrayPipe`   | string → array                                               | Splits on `,` by default; override with `new ParseArrayPipe({ separator: ';' })`. Internally [constructs a `ValidationPipe({ transform: true, validateCustomDecorators: true })`](https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-array.pipe.ts) to coerce items. See [validating an array body](#gotchas) |
| `ParseUUIDPipe`    | UUID string validation                                       | `version?: '3' \| '4' \| '5' \| '7'` ([source](https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-uuid.pipe.ts)). Default validates **any** UUID shape (the docs page still says "3, 4 or 5" but the pipe falls back to a version-agnostic regex when `version` is omitted)                                   |
| `ParseEnumPipe`    | enum membership check                                        | Constructor requires the enum. See [composing pipes](#common-recipes)                                                                                                                                                                                                                                                             |
| `ParseDatePipe`    | string/number → `Date`                                       | [`new Date(value)` then `getTime()` NaN-check](https://github.com/nestjs/nest/blob/master/packages/common/pipes/parse-date.pipe.ts); supports `default: () => Date` when `optional: true`                                                                                                                                         |
| `DefaultValuePipe` | fallback when nil                                            | Returns the configured default when the value is `null`, `undefined`, or `NaN` ([source](https://github.com/nestjs/nest/blob/master/packages/common/pipes/default-value.pipe.ts)). See [the section below](#defaultvaluepipe)                                                                                                     |
| `ParseFilePipe`    | upload validation                                            | Compose `MaxFileSizeValidator` + `FileTypeValidator` directly, or use the fluent `ParseFilePipeBuilder`. See [[nestjs/recipes/file-uploads\|File uploads recipe]]                                                                                                                                                                 |

### Common options across `Parse*` pipes

| Option                | Default               | What it does                                          |
| --------------------- | --------------------- | ----------------------------------------------------- |
| `errorHttpStatusCode` | `400`                 | Status used when validation fails                     |
| `exceptionFactory`    | `BadRequestException` | Build a custom exception from the error string        |
| `optional`            | `false`               | When `true`, nil values pass through instead of throw |

## Binding

| Scope      | How                                                                  |
| ---------- | -------------------------------------------------------------------- | ------------------- |
| Global     | `app.useGlobalPipes()` or the [[nestjs/fundamentals/global-providers | APP_PIPE provider]] |
| Controller | `@UsePipes()` on the class                                           |
| Route      | `@UsePipes()` on the method                                          |
| Param      | `@Body(new ValidationPipe())`                                        |

> [!warning] Pass the class to `@UsePipes`, not an instance
> `@UsePipes(MyPipe)` is resolved by Nest's DI container so the pipe's constructor injections work. `@UsePipes(new MyPipe())` skips DI: any injected dependency is `undefined` and the pipe crashes the first time it touches it. The param-level form `@Body(new ValidationPipe({ whitelist: true }))` is a deliberate exception: built-in pipes like `ValidationPipe` take a stateless options object rather than DI-resolved dependencies, so the instance form is idiomatic there. Same trap covered in detail at [[nestjs/fundamentals/guards#Binding|Guards > Binding]].

The global-scope variant of the same DI question: `useGlobalPipes(new X())` vs `APP_PIPE`: has its own dedicated note: [[nestjs/fundamentals/global-providers|Global pipes, guards, interceptors, and filters via DI]]. It covers the side-by-side comparison, request-scope and hybrid-app implications, and when to reach for `useClass` vs `useFactory`.

## Order: scopes and per-param resolution

Standard order is global, controller, route. Per-parameter pipes resolve **concurrently**: [`router-execution-context.ts` `createPipesFn`](https://github.com/nestjs/nest/blob/master/packages/core/router/router-execution-context.ts) wraps each parameter's resolution in `Promise.all(paramsOptions.map(resolveParamValue))`. Within a single parameter, [`pipes-consumer.ts`](https://github.com/nestjs/nest/blob/master/packages/core/pipes/pipes-consumer.ts) reduces the pipe list **left-to-right** (first pipe sees the raw value, last pipe's output reaches the handler). Don't write per-param pipes that depend on a particular ordering across parameters; if one needs another's output, fold them into a single pipe.

```typescript
import {
  Body,
  Controller,
  Injectable,
  Param,
  ParseIntPipe,
  Patch,
  PipeTransform,
  Query,
  UsePipes,
} from "@nestjs/common";

// Two placeholder pipes — imagine each as a real ValidationPipe configuration.
@Injectable()
class GeneralValidationPipe implements PipeTransform {
  transform(v: unknown) {
    return v;
  }
}
@Injectable()
class RouteSpecificPipe implements PipeTransform {
  transform(v: unknown) {
    return v;
  }
}

// Placeholder DTO/param/query types for the example signature.
class UpdateCatDTO {}
class UpdateCatParams {
  id!: string;
}
class UpdateCatQuery {}

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
// GeneralValidationPipe and RouteSpecificPipe both run on each of body,
// params, and query. Across the three parameters they resolve concurrently
// (Promise.all); within each parameter, GeneralValidationPipe runs first,
// then RouteSpecificPipe.
```

## DefaultValuePipe

Returns its constructor argument when the incoming value is `null`, `undefined`, or `NaN`. **Order matters** when chaining:

```typescript
import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from "@nestjs/common";

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

> [!info] What "missing" means
> The default kicks in for `null`, `undefined`, and `NaN`. An **empty string** (`?page=`) is **not** nil, so it passes through and `ParseIntPipe` will throw. If you need to treat empty strings as missing, normalize upstream (e.g., a custom pipe).

## ValidationPipe

> [!info] Deep dive lives in the [[nestjs/recipes/validation|validation recipe]]
> This section is a reference for the option flags. For end-to-end DTO patterns: global setup, `whitelist`, `transform`, validation groups, nested objects, custom validators, `exceptionFactory`: see the recipe.

Install peer deps:

```bash
npm i class-validator class-transformer
```

### Built-in options (from `ValidationPipeOptions`)

| Option                     | Default                           | What it does                                                                                                                          |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `transform`                | `false`                           | Run `class-transformer` to instantiate DTO classes from plain objects. Required if you want primitives coerced or DTO methods to work |
| `transformOptions`         | `undefined`                       | Forwarded to `class-transformer`. Common: `enableImplicitConversion: true` to coerce strings → number/boolean based on TS types       |
| `disableErrorMessages`     | `false`                           | Hide validation messages in the response (use in production)                                                                          |
| `errorHttpStatusCode`      | `400`                             | Status used when validation fails (e.g., set to `422`)                                                                                |
| `exceptionFactory`         | flattens to `BadRequestException` | Custom exception shape                                                                                                                |
| `validateCustomDecorators` | `false`                           | Validate args from custom param decorators too                                                                                        |
| `expectedType`             | `undefined`                       | Force the type to validate against (overrides metatype)                                                                               |

### Inherited `class-validator` options (subset)

| Option                  | Default     | What it does                                                                                                                                                            |
| ----------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `whitelist`             | `false`     | Strip properties without validation decorators                                                                                                                          |
| `forbidNonWhitelisted`  | `false`     | Throw instead of stripping                                                                                                                                              |
| `forbidUnknownValues`   | `false`     | Reject unknown objects. Nest forces `false` even though `class-validator`'s own default is `true` ([issue #10683](https://github.com/nestjs/nest/issues/10683))         |
| `skipMissingProperties` | `false`     | Skip validation for null/undefined props                                                                                                                                |
| `stopAtFirstError`      | `false`     | Stop at the first failing decorator per property                                                                                                                        |
| `groups`                | `undefined` | Validation groups: same DTO, different rules per route. See [[nestjs/recipes/validation#Validation groups: same DTO, different rules per route\|the validation recipe]] |

Full table: [Validation docs](https://docs.nestjs.com/techniques/validation).

> [!example]- Recommended global setup
>
> ```typescript
> // main.ts
> import { NestFactory } from "@nestjs/core";
> import { ValidationPipe } from "@nestjs/common";
> import { AppModule } from "./app.module";
>
> async function bootstrap(): Promise<void> {
>   const app = await NestFactory.create(AppModule);
>   app.useGlobalPipes(
>     new ValidationPipe({
>       whitelist: true,
>       forbidNonWhitelisted: true,
>       transform: true,
>       transformOptions: { enableImplicitConversion: true },
>     }),
>   );
>   await app.listen(process.env.PORT ?? 3000);
> }
> bootstrap();
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
> import { PipeTransform, BadRequestException } from "@nestjs/common";
> import { ZodSchema } from "zod";
>
> export class ZodValidationPipe implements PipeTransform {
>   constructor(private schema: ZodSchema) {}
>
>   transform(value: unknown) {
>     const parsed = this.schema.safeParse(value);
>     if (!parsed.success) throw new BadRequestException(parsed.error.format());
>     return parsed.data;
>   }
> }
> ```
>
> Bind per param: `@Body(new ZodValidationPipe(createUserSchema))`. Source: [zod](https://github.com/colinhacks/zod), [Nest docs example](https://docs.nestjs.com/pipes#object-schema-validation).

## Common recipes

> [!example]- Trim and normalize string input
>
> Pure transform pipe. No exception path: just clean the value and pass it on.
>
> ```typescript
> import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
>
> @Injectable()
> export class TrimPipe implements PipeTransform<unknown, unknown> {
>   transform(value: unknown, _metadata: ArgumentMetadata) {
>     if (typeof value === "string") return value.trim();
>     if (value && typeof value === "object") {
>       for (const key of Object.keys(value)) {
>         const v = (value as Record<string, unknown>)[key];
>         if (typeof v === "string") (value as Record<string, unknown>)[key] = v.trim();
>       }
>     }
>     return value;
>   }
> }
> ```
>
> Bind globally with `app.useGlobalPipes(new TrimPipe(), new ValidationPipe(...))`. Order matters: `TrimPipe` runs first so `@IsNotEmpty()` sees the trimmed string.

> [!example]- Param to entity lookup (async pipe)
>
> Resolve a route param into a domain entity once, instead of every handler doing the DB call itself. Throws `404` if missing.
>
> ```typescript
> import { ArgumentMetadata, Injectable, NotFoundException, PipeTransform } from "@nestjs/common";
> import { CatsService } from "./cats.service";
> import { Cat } from "./cat.entity";
>
> @Injectable()
> export class CatByIdPipe implements PipeTransform<string, Promise<Cat>> {
>   constructor(private readonly cats: CatsService) {}
>
>   async transform(id: string, _metadata: ArgumentMetadata): Promise<Cat> {
>     const cat = await this.cats.findById(id);
>     if (!cat) throw new NotFoundException(`Cat ${id} not found`);
>     return cat;
>   }
> }
> ```
>
> ```typescript
> import { Controller, Get, Param } from "@nestjs/common";
> import { CatByIdPipe } from "./cat-by-id.pipe";
> import { Cat } from "./cat.entity";
>
> @Controller("cats")
> export class CatsController {
>   @Get(":id")
>   getOne(@Param("id", CatByIdPipe) cat: Cat) {
>     return cat;
>   }
> }
> ```
>
> The handler receives the entity directly. The pipe is `@Injectable()`, so Nest wires `CatsService` automatically. Source: [Pipes > Providing defaults](https://docs.nestjs.com/pipes#providing-defaults).

> [!example]- Compose multiple pipes on the same param
>
> Pipes after the first receive the **previous pipe's output**, not the raw value. Use this to default-then-coerce, or coerce-then-validate.
>
> ```typescript
> import {
>   Controller,
>   DefaultValuePipe,
>   Get,
>   ParseEnumPipe,
>   ParseIntPipe,
>   Query,
> } from "@nestjs/common";
>
> enum SortOrder {
>   Asc = "asc",
>   Desc = "desc",
> }
>
> @Controller("cats")
> export class CatsController {
>   @Get()
>   list(
>     @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
>     @Query("order", new DefaultValuePipe(SortOrder.Asc), new ParseEnumPipe(SortOrder))
>     order: SortOrder,
>   ) {}
> }
> ```
>
> Same param, multiple pipes, evaluated left-to-right. `DefaultValuePipe` first so downstream pipes never see `undefined`.

## Common errors

| Symptom                                 | Likely cause                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| DTO instance methods are `undefined`    | Missing `transform: true`: you got a plain object                                                                |
| Numbers arrive as strings               | Add `transformOptions: { enableImplicitConversion: true }` or use `@Type(() => Number)` from `class-transformer` |
| Extra fields appear in DTO              | Enable `whitelist: true` to strip them                                                                           |
| Validation always passes                | Pipe not bound globally, or DTO class lacks decorators                                                           |
| `ParseIntPipe` throws on optional param | Either provide a `DefaultValuePipe` first, or pass `{ optional: true }` to `ParseIntPipe`                        |

## Gotchas

> [!info]- `enableImplicitConversion` does not handle every type
> [`class-transformer`](https://github.com/typestack/class-transformer/blob/develop/src/TransformOperationExecutor.ts) implicit conversion only triggers in `plain → class` direction, reads `Reflect.getMetadata('design:type', ...)` (so the property needs at least one decorator), and only knows how to convert `String`, `Number`, `Boolean`, `Date`, `Buffer`. Where it works and where it doesn't:
>
> - **`string`, `number`, `boolean`, `Date`**: implicit conversion is enough. `@Type()` not needed.
> - **Branded types** (`string & { __brand: 'Id' }`): converts as the base type (`String`). The brand is compile-time only, no runtime guarantee: add `@IsUUID()`, regex, or a custom validator if you care.
> - **Nested class** (no circular imports): sometimes works implicitly, but **always declare `@Type(() => NestedClass)`** to be safe.
> - **Array of classes** (`items: Item[]`): does not work. TS emits `design:type = Array` with no element info. `@Type(() => Item)` is **required**.
> - **`interface` / structural type**: does not work. TS emits `design:type = Object`, the value stays as a plain object. Use a real class.
>
> Rule of thumb: implicit conversion is a primitive-coercion shortcut, not a substitute for `@Type()` on anything object-shaped.

> [!warning]- Arrays of classes need both `@Type()` and `@ValidateNested({ each: true })`
> The `Item[]` in TypeScript is invisible at runtime: class-transformer reads `Array.isArray(value)` and applies whatever `@Type()` says to **each element**. Without `@Type()`, elements stay as plain objects. Without `@ValidateNested({ each: true })` from [`class-validator`](https://github.com/typestack/class-validator#validating-nested-objects), the decorators inside `Item` (`@IsString()`, `@IsInt()`, etc.) **are not executed** on the children: silent pass.
>
> ```ts
> import { Type } from "class-transformer";
> import { ValidateNested, IsString } from "class-validator";
>
> class Item {
>   @IsString()
>   name: string;
> }
>
> export class CreatePostDto {
>   @ValidateNested({ each: true })
>   @Type(() => Item)
>   items: Item[];
> }
> ```
>
> What each setup gives you:
>
> - **Neither decorator** → `items` stays an array of plain objects, children not validated.
> - **`@Type(() => Item)` alone** → `items` becomes `Item` instances, but `@IsString()` inside `Item` never runs (no `@ValidateNested`).
> - **`@ValidateNested({ each: true })` alone** → `items` stays plain objects, validator has no class to validate against.
> - **Both** → `items` becomes `Item` instances **and** their decorators run. ✅
>
> Same combo applies to single nested objects (`item: Item` → `@ValidateNested()` without `each`). See [`class-transformer`](https://github.com/typestack/class-transformer/blob/develop/src/TransformOperationExecutor.ts) and the [class-validator nested objects docs](https://github.com/typestack/class-validator#validating-nested-objects).

> [!warning]- `import type { Dto }` silently disables validation
> `ValidationPipe` reads the runtime metatype emitted by TypeScript (`Reflect.getMetadata('design:paramtypes', ...)`). A type-only import is erased at compile time, so the metatype becomes `Object` and the pipe falls back to passing the value through untouched: no decorator runs, no error thrown. Always import DTOs as values:
>
> ```ts
> import { CreateUserDto } from "./create-user.dto"; // ✅
> import type { CreateUserDto } from "./create-user.dto"; // ❌ validation disabled
> ```
>
> Source: [Auto-validation](https://docs.nestjs.com/techniques/validation#auto-validation).

> [!warning]- Generics and interfaces have no runtime metadata
> TypeScript erases generics and interfaces during compilation, so they leave nothing for `class-validator` to inspect. `ValidationPipe` will not validate `Partial<CreateCatDto>`, `Pick<...>`, a bare interface, or a union type. Use a concrete class (often via [`@nestjs/mapped-types`](https://docs.nestjs.com/openapi/mapped-types) helpers like `PartialType`, `PickType`, `OmitType`, `IntersectionType`). Source: [Auto-validation](https://docs.nestjs.com/techniques/validation#auto-validation).

> [!warning]- `body: CreateUserDto[]` is not validated as an array of DTOs
> `@Body() bulk: CreateUserDto[]` reaches the pipe with `metatype = Array`: the element type is gone. The pipe iterates nothing and passes the array through. Two fixes:
>
> ```ts
> import { Body, Controller, ParseArrayPipe, Post } from "@nestjs/common";
> import { Type } from "class-transformer";
> import { ValidateNested } from "class-validator";
> import { CreateUserDto } from "./create-user.dto";
>
> // 1. ParseArrayPipe carries the element class explicitly
> @Controller("users")
> export class UsersController {
>   @Post("bulk")
>   createBulk(
>     @Body(new ParseArrayPipe({ items: CreateUserDto }))
>     bulk: CreateUserDto[],
>   ) {}
> }
>
> // 2. Wrap in a DTO with @Type()
> export class CreateUsersDto {
>   @ValidateNested({ each: true })
>   @Type(() => CreateUserDto)
>   users: CreateUserDto[];
> }
> ```
>
> Source: [Parsing and validating arrays](https://docs.nestjs.com/techniques/validation#parsing-and-validating-arrays).

> [!warning]- `@Req()` / `@Res()` bypass the pipe layer
> Pipes run on **decorator-extracted arguments** (`@Body`, `@Param`, `@Query`, custom decorators). When you grab `@Req()` or `@Res()` directly, you're working with the raw Express/Fastify objects: no metatype, no pipe runs. If you need validation, decorate properties (`@Body() body: Dto`) instead of reaching into `req.body` yourself.

## When to reach for it

- DTO validation with `class-validator` and `ValidationPipe`.
- String to number or string to UUID coercion.
- Trim, lowercase, normalize input shape.

## When not to

- Authorization decisions: use [[nestjs/fundamentals/guards|a guard]]. Pipes run **after** guards in the [[nestjs/fundamentals/request-lifecycle|pipeline]] (verifiable by reading [`router-execution-context.ts`](https://github.com/nestjs/nest/blob/master/packages/core/router/router-execution-context.ts), which calls `tryActivate` for guards before the param-pipe loop) and have no concept of "deny this request".
- Mutating the raw request before any handler-level concern: use [[nestjs/fundamentals/middleware|middleware]]: pipes only see one argument at a time, not the whole request object.
- Wrapping the response or timing the handler: that's an [[nestjs/fundamentals/interceptors|interceptor]]. Pipes don't run on the way out.
- Catching a thrown error to reshape it: use an [[nestjs/fundamentals/exception-filters|exception filter]]. A pipe's job ends at "throw".

## See also

- [[request-lifecycle|Request lifecycle hub]]
- [[nestjs/recipes/file-uploads|File uploads recipe (ParseFilePipe in action)]]
