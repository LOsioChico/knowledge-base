---
title: Request Lifecycle
aliases: [request pipeline, execution order]
tags: [type/concept, lifecycle]
area: nestjs
status: evergreen
related:
  - "[[nestjs/index]]"
  - "[[nestjs/fundamentals/middleware]]"
  - "[[nestjs/fundamentals/guards]]"
  - "[[nestjs/fundamentals/interceptors]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/recipes/file-uploads]]"
source:
  - https://docs.nestjs.com/faq/request-lifecycle
---

How a request flows through a NestJS app, from socket to response. Knowing the order tells you where to put each piece of logic.

## The pipeline

```mermaid
flowchart TD
    A[Incoming request] --> M[Middlewares]
    M --> EZ
    subgraph EZ [Exception Zone]
        direction TB
        G[Guards] --> BI[Before Interceptor]
        BI --> P[Pipes]
        P --> C[Controllers]
        C --> AI[After Interceptor]
    end
    BI -. same interceptor wraps both .- AI
    AI --> R[Response]
    G -.throws.-> EF[Exception Filters]
    BI -.throws.-> EF
    P -.throws.-> EF
    C -.throws.-> EF
    EF --> R
```

> [!info]- The two interceptor boxes are the **same** interceptor
> A single `intercept(context, next)` call wraps the handler. The "before" box is the code that runs prior to invoking the handler; the "after" box is the logic chained on the returned stream. Two boxes in the diagram, **one** method. Details in [[interceptors#The pre/post pattern|Interceptors > The pre/post pattern]].
>
> You can stack multiple interceptors (global + controller + route). Each one wraps the next, so the boxes nest like onion layers — pre runs in registration order, post runs in **FILO** (first in, last out).

## The order

1. Incoming request hits the HTTP adapter.
2. [[middleware|Middleware]]: global, then module bound.
3. [[guards|Guards]]: global, controller, route.
4. [[interceptors|Interceptors]] (before): global, controller, route.
5. [[pipes|Pipes]]: global, controller, route, then route parameters in reverse order.
6. **Controller handler** runs.
7. [[interceptors|Interceptors]] (after): route, controller, global. FILO order — first interceptor in is the last one out.
8. If anything threw, [[exception-filters|Exception filters]] catch it, resolving from route up to global.
9. Response is sent.

## Why the order matters

Pick the right tool by asking _when_ it should run:

| Need                                            | Tool                                     |
| ----------------------------------------------- | ---------------------------------------- |
| Mutate the raw request, attach correlation IDs  | [[middleware\|Middleware]]               |
| Authorization decision before any work          | [[guards\|Guards]]                       |
| Wrap the handler with logging, caching, retries | [[interceptors\|Interceptors]]           |
| Validate or transform input                     | [[pipes\|Pipes]]                         |
| Convert a thrown error into an HTTP response    | [[exception-filters\|Exception filters]] |

## Source

Adapted from the official [NestJS Request Lifecycle FAQ](https://docs.nestjs.com/faq/request-lifecycle).
