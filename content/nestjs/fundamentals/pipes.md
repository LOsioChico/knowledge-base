---
title: Pipes
aliases: [validation pipe, transform pipe]
tags: [type/concept, lifecycle, validation]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/exception-filters]]"
source:
  - https://docs.nestjs.com/pipes
---

> Transform or validate input data **before** it reaches the route handler.

## Signature

```typescript
@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) throw new BadRequestException();
    return parsed;
  }
}
```

## Binding

| Scope | How |
|---|---|
| Global | `app.useGlobalPipes()` or the `APP_PIPE` provider |
| Controller | `@UsePipes()` on the class |
| Route | `@UsePipes()` on the method |
| Param | `@Body(new ValidationPipe())` |

## Order: the param level reversal

Standard order is global, controller, route. But at the **route parameter level**, pipes run from the **last parameter to the first**:

```typescript
@UsePipes(GeneralValidationPipe)
@Controller('cats')
export class CatsController {
  @UsePipes(RouteSpecificPipe)
  @Patch(':id')
  updateCat(
    @Body() body: UpdateCatDTO,
    @Param() params: UpdateCatParams,
    @Query() query: UpdateCatQuery,
  ) {}
}
// GeneralValidationPipe runs on: query, then params, then body.
// Then RouteSpecificPipe runs in the same reversed order.
```

## When to reach for it

- DTO validation with `class-validator` and `ValidationPipe`.
- String to number or string to UUID coercion.
- Trim, lowercase, normalize input shape.

## See also

- [[request-lifecycle|Request lifecycle hub]]
