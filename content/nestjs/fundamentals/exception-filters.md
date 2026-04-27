---
title: Exception Filters
aliases: [error handler, http exception filter]
tags: [type/concept, lifecycle, errors]
area: nestjs
status: evergreen
related:
  - "[[nestjs/fundamentals/request-lifecycle]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/recipes/trace-id]]"
source:
  - https://docs.nestjs.com/exception-filters
---

> Catch unhandled exceptions and turn them into HTTP responses. The **only** lifecycle component that resolves bottom up.

## Signature

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common"
import { Response } from "express"

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    response.status(exception.getStatus()).json({
      error: exception.message,
    })
  }
}
```

## Binding

| Scope      | How                                                   |
| ---------- | ----------------------------------------------------- |
| Global     | `app.useGlobalFilters()` or the `APP_FILTER` provider |
| Controller | `@UseFilters()` on the class                          |
| Route      | `@UseFilters()` on the method                         |

## Order: route first, then controller, then global

Filters resolve from the lowest level up. **Route bound** filters run first, then **controller**, then **global**. The opposite of every other lifecycle component.

Once a filter catches the exception, **no other filter** sees it. To layer behavior, use class inheritance, not stacking.

## Caught vs uncaught

Filters only fire on **uncaught** exceptions. A `try/catch` inside the controller swallows the error before it reaches the filter chain.

## When to reach for it

- Standardize the error response shape across the API.
- Map domain errors to HTTP codes (`UserNotFoundError` to `404`).
- Forward errors to a tracker (Sentry, DataDog) before responding.

## See also

- [[request-lifecycle|Request lifecycle hub]]
- [[nestjs/patterns/error-handling|Error handling patterns (planned)]]
