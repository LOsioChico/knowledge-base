---
title: Handle database errors
aliases:
  [
    QueryFailedError,
    unique violation,
    constraint violation,
    duplicate key,
    23505,
    ER_DUP_ENTRY,
  ]
tags: [type/recipe, tech/typeorm, tech/postgres, errors]
area: nestjs
status: evergreen
related:
  - "[[nestjs/data/typeorm/index]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/recipes/validation]]"
source:
  - https://github.com/typeorm/typeorm/blob/master/src/error/QueryFailedError.ts
  - https://www.postgresql.org/docs/current/errcodes-appendix.html
  - https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
  - https://docs.nestjs.com/exception-filters
---

> Catch `QueryFailedError`, branch on the driver SQLSTATE, throw a domain `HttpException`. Centralize in one filter so controllers stay clean.

## Setup

```bash
npm install typeorm pg
npm install --save-dev @types/pg
```

## The shape of a `QueryFailedError`

TypeORM wraps every driver failure in `QueryFailedError`. The constructor copies the driver error's enumerable properties onto the wrapper, so `err.code`, `err.detail`, `err.constraint` (Postgres) or `err.errno`, `err.sqlMessage` (MySQL) are accessible **directly** on the caught error:

```typescript
// from typeorm/src/error/QueryFailedError.ts
export class QueryFailedError<T extends Error = Error> extends TypeORMError {
  constructor(
    readonly query: string,
    readonly parameters: any[] | ObjectLiteral | undefined,
    readonly driverError: T,
  ) {
    super(/* ...message... */)
    if (driverError) {
      const { name: _, ...otherProperties } = driverError
      Object.assign(this, { ...otherProperties }) // ← spread onto `this`
    }
  }
}
```

So both work; prefer the flat access. Define a small augmentation type and a reusable type guard once, then read driver fields without `as any` anywhere:

```typescript
// db-errors.ts
import { QueryFailedError } from "typeorm"

// QueryFailedError's typed properties are only query/parameters/driverError.
// `code`, `detail`, `constraint`, etc. are spread onto the instance at runtime
// by the constructor (Object.assign above), so we widen the type to expose them.
export type PgQueryError = QueryFailedError & {
  code?: string
  detail?: string
  constraint?: string
  table?: string
  column?: string
}

export const PG = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  NOT_NULL_VIOLATION: "23502",
  CHECK_VIOLATION: "23514",
} as const

/** True iff `err` is a Postgres unique-violation, optionally matching a named constraint. */
export function isUniqueViolation(
  err: unknown,
  constraint?: string,
): err is PgQueryError {
  if (!(err instanceof QueryFailedError)) return false
  const e = err as PgQueryError
  if (e.code !== PG.UNIQUE_VIOLATION) return false
  return constraint === undefined || e.constraint === constraint
}
```

```typescript
catch (err: unknown) {
  if (err instanceof QueryFailedError) {
    const e = err as PgQueryError
    const code = e.code              // typed access, no `any`
    const code2 = (err.driverError as { code?: string }).code // also valid
  }
}
```

## Driver error code reference

| Constraint | Postgres SQLSTATE | MySQL `errno` | SQLite `code` | Mapped in |
| --- | --- | --- | --- | --- |
| Unique | `23505` | `1062` (`ER_DUP_ENTRY`) | `SQLITE_CONSTRAINT_UNIQUE` | [Recipe 1 filter](#recipe-1-centralize-in-an-exception-filter-recommended-for-nestjs), [Recipe 2 service](#recipe-2-catch-in-the-service-when-you-need-domain-context) |
| Foreign key | `23503` | `1452` (`ER_NO_REFERENCED_ROW_2`) on insert, `1451` on delete | `SQLITE_CONSTRAINT_FOREIGNKEY` | [Recipe 1 filter](#recipe-1-centralize-in-an-exception-filter-recommended-for-nestjs) |
| Not null | `23502` | `1048` (`ER_BAD_NULL_ERROR`) | `SQLITE_CONSTRAINT_NOTNULL` | [Recipe 1 filter](#recipe-1-centralize-in-an-exception-filter-recommended-for-nestjs) |
| Check | `23514` | `3819` (`ER_CHECK_CONSTRAINT_VIOLATED`) | `SQLITE_CONSTRAINT_CHECK` | [Recipe 1 filter](#recipe-1-centralize-in-an-exception-filter-recommended-for-nestjs) |
| Exclusion (PG only) | `23P01` | n/a | n/a | not mapped |
| Concurrent-update conflict (retryable, txn-level) | `40001` | `1213` (`ER_LOCK_DEADLOCK`) | n/a | [Retryable errors gotcha](#gotchas) |

Postgres SQLSTATE values are stable across versions. `err.code` is a **string**; MySQL `err.errno` is a **number**.

## Recipe 1: Centralize in an exception filter (recommended for NestJS)

One filter, registered globally, maps every database failure to the right HTTP status. Controllers just call `repository.save()` and let the filter translate.

```typescript
// typeorm-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common"
import { BaseExceptionFilter } from "@nestjs/core"
import { QueryFailedError } from "typeorm"
import { PG, PgQueryError } from "./db-errors"

// Postgres SQLSTATE codes — https://www.postgresql.org/docs/current/errcodes-appendix.html

@Catch(QueryFailedError)
export class TypeOrmExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(TypeOrmExceptionFilter.name)

  catch(exception: PgQueryError, host: ArgumentsHost): void {
    const mapped = this.toHttp(exception)
    if (mapped instanceof InternalServerErrorException) {
      this.logger.error(
        `Unmapped DB error code=${exception.code} detail=${exception.detail}`,
        exception.stack,
      )
    }
    super.catch(mapped, host)
  }

  private toHttp(err: PgQueryError): HttpException {
    switch (err.code) {
      case PG.UNIQUE_VIOLATION:
        return new ConflictException({
          error: "DUPLICATE",
          constraint: err.constraint,
          detail: err.detail,
        })
      case PG.FOREIGN_KEY_VIOLATION:
        return new ConflictException({
          error: "FK_VIOLATION",
          constraint: err.constraint,
          detail: err.detail,
        })
      case PG.NOT_NULL_VIOLATION:
        return new UnprocessableEntityException({
          error: "NOT_NULL",
          column: err.column,
        })
      case PG.CHECK_VIOLATION:
        return new UnprocessableEntityException({
          error: "CHECK",
          constraint: err.constraint,
        })
      default:
        return new InternalServerErrorException()
    }
  }
}
```

Register globally:

```typescript
// app.module.ts
import { Module } from "@nestjs/common"
import { APP_FILTER } from "@nestjs/core"
import { TypeOrmExceptionFilter } from "./typeorm-exception.filter"

@Module({
  providers: [{ provide: APP_FILTER, useClass: TypeOrmExceptionFilter }],
})
export class AppModule {}
```

### What the client sees

Given a unique index on `users.email` (named `users_email_key` — see [Recipe 2](#recipe-2-catch-in-the-service-when-you-need-domain-context) for why naming matters), posting a duplicate email:

```http
POST /users
Content-Type: application/json

{ "email": "ada@example.com", "name": "Ada" }
```

The filter responds:

```json
{
  "statusCode": 409,
  "error": "DUPLICATE",
  "constraint": "users_email_key",
  "detail": "Key (email)=(ada@example.com) already exists."
}
```

> [!warning]- `detail` leaks the raw value
> Postgres puts the offending value in `detail`. For PII (emails, phone numbers, anything authenticated-but-sensitive), strip or redact `detail` before sending it to the client. Keep it in server logs only.

## Recipe 2: Catch in the service (when you need domain context)

The filter approach is generic. When you need to attach domain meaning (e.g., "this specific unique violation means the email is taken; that one means the username is"), catch in the service. This requires **named** unique constraints so you can branch on `err.constraint`. TypeORM gives three ways to declare uniqueness, and only one of them is right for this job:

| Decorator | What TypeORM registers | What Postgres emits | Naming control | Composite |
| --- | --- | --- | --- | --- |
| `@Column({ unique: true })` | a `uniques` metadata entry | `ADD CONSTRAINT "UQ_<hash>" UNIQUE (...)` | ❌ auto-named (`UQ_2e7b…`) | ❌ single column only |
| `@Unique('name', ['col'])` (class-level) | a `uniques` metadata entry **with a name** | `ADD CONSTRAINT "name" UNIQUE (...)` | ✅ | ✅ |
| `@Index('name', ['col'], { unique: true })` | an `indices` metadata entry | `CREATE UNIQUE INDEX "name" ON ...` | ✅ | ✅ |

Postgres enforces all three identically (a UNIQUE constraint is implemented via a unique index under the hood), but the metadata location differs: `@Unique` shows up in `pg_constraint`, `@Index` only in `pg_indexes`. Use `@Unique` — it matches what you're actually modeling ("no two users with the same email"), and `err.constraint` will report the constraint name directly.

```typescript
// user.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm"

@Entity()
@Unique("users_email_key", ["email"])
@Unique("users_username_key", ["username"])
export class User {
  @PrimaryGeneratedColumn("uuid") id!: string
  @Column() email!: string
  @Column() username!: string
}
```

With those names in place, the service can branch on `err.constraint`:

```typescript
// users.service.ts
import { ConflictException, Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { isUniqueViolation } from "./db-errors"
import { User } from "./user.entity"

// Map each named unique constraint to a domain error code.
const USER_CONFLICTS: Record<string, string> = {
  users_email_key: "EMAIL_TAKEN",
  users_username_key: "USERNAME_TAKEN",
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(data: Pick<User, "email" | "username">): Promise<User> {
    try {
      return await this.users.save(this.users.create(data))
    } catch (err: unknown) {
      if (isUniqueViolation(err) && err.constraint) {
        const code = USER_CONFLICTS[err.constraint]
        if (code) throw new ConflictException({ error: code })
      }
      throw err // Re-throw; the global filter handles the rest.
    }
  }
}
```

Sample response for a duplicate email:

```json
{ "statusCode": 409, "error": "EMAIL_TAKEN" }
```

## When to use which

| Approach | Use when | Trade-off |
| --- | --- | --- |
| Global filter (Recipe 1) | You want consistent JSON for every DB error across all controllers | Generic messages; can't map "which unique" to "which domain meaning" |
| Service-level catch (Recipe 2) | You need domain-specific error codes (`EMAIL_TAKEN` vs `USERNAME_TAKEN`) | Boilerplate per service; only handles the cases you explicitly catch |
| Both (recommended for non-trivial APIs) | Service catches the constraints it cares about; filter handles the rest | Two layers, but each does one thing |

## Gotchas

> [!warning]- Don't match on `err.message`
> Driver messages are locale-dependent on MySQL and can change between Postgres minor versions. Always branch on `err.code` (Postgres SQLSTATE) or `err.errno` (MySQL).

> [!warning]- Driver props live in two places, by design
> `QueryFailedError`'s constructor spreads every own property of `driverError` (except `name`) onto the error instance via `ObjectUtils.assign`, so `err.code` and `err.driverError.code` return the same value. Prefer the flat read; fall back to `err.driverError` only when you need to keep the original driver error object (e.g. to forward it to Sentry with its native shape).

> [!warning]- Transaction rollback is not automatic for non-`QueryRunner` errors
> If you `await dataSource.transaction(...)` and **throw** inside the callback, TypeORM rolls back. If you `try/catch` inside the callback and **don't re-throw**, the transaction commits with the broken state. Always re-throw after logging.

> [!info]- Retryable errors
> Postgres `40001` (`could_not_serialize`) and MySQL `1213` (deadlock) are recoverable: retry the transaction with backoff. Map them to a 503 with `Retry-After` rather than 500.

> [!info]- `EntityNotFoundError` is separate
> `repository.findOneOrFail()` throws `EntityNotFoundError`, not `QueryFailedError`. Catch it independently and map to 404. The filter above does not cover it.

> [!todo]- Verify on TypeORM 0.4 release
> `QueryFailedError` constructor signature has been stable through 0.3.x; re-check that the `Object.assign(this, ...driverError)` spread still happens in 0.4.

## See also

- [[nestjs/fundamentals/exception-filters|Exception filters]]: how `BaseExceptionFilter`, `@Catch`, and `APP_FILTER` work.
- [[nestjs/recipes/validation|Request validation]]: catch bad input **before** it reaches the database.
- [TypeORM `QueryFailedError` source](https://github.com/typeorm/typeorm/blob/master/src/error/QueryFailedError.ts)
- [PostgreSQL error codes (Appendix A)](https://www.postgresql.org/docs/current/errcodes-appendix.html)
- [MySQL server error reference](https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html)
