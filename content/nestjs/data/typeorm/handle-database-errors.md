---
title: Handling database errors
aliases:
  [
    QueryFailedError,
    unique violation,
    constraint violation,
    duplicate key,
    23505,
    ER_DUP_ENTRY,
    Handle database errors,
  ]
tags: [type/recipe, tech/typeorm, tech/postgres, errors]
area: nestjs
status: evergreen
related:
  - "[[nestjs/data/typeorm/index]]"
  - "[[nestjs/data/typeorm/postgresql-setup]]"
  - "[[nestjs/fundamentals/exception-filters]]"
  - "[[nestjs/fundamentals/pipes]]"
  - "[[nestjs/recipes/validation]]"
source:
  - https://github.com/typeorm/typeorm/blob/master/src/error/QueryFailedError.ts
  - https://github.com/typeorm/typeorm/blob/master/src/util/ObjectUtils.ts
  - https://github.com/typeorm/typeorm/blob/master/src/decorator/Unique.ts
  - https://github.com/typeorm/typeorm/blob/master/src/decorator/Index.ts
  - https://github.com/brianc/node-postgres/blob/master/packages/pg-protocol/src/messages.ts
  - https://www.postgresql.org/docs/current/errcodes-appendix.html
  - https://www.postgresql.org/docs/current/protocol-error-fields.html
  - https://www.postgresql.org/docs/current/catalog-pg-constraint.html
  - https://www.postgresql.org/docs/current/view-pg-indexes.html
  - https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
  - https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
  - https://github.com/nestjs/nest/blob/master/packages/core/exceptions/base-exception-filter.ts
---

> Catch `QueryFailedError`, branch on the driver SQLSTATE, throw a domain `HttpException`. Centralize in one filter so controllers stay clean.

## Setup

```bash
npm install @nestjs/typeorm typeorm pg
npm install --save-dev @types/pg
```

`@nestjs/typeorm` provides `TypeOrmModule.forRoot/forFeature` and `@InjectRepository`. The recipes below use both.

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
    super(/* ...message... */);
    if (driverError) {
      const { name: _, ...otherProperties } = driverError;
      ObjectUtils.assign(this, { ...otherProperties }); // ← spread onto `this`
    }
  }
}
```

`ObjectUtils.assign` is TypeORM's small wrapper that copies every own property from each source onto the target via a `for (prop of Object.getOwnPropertyNames(source))` loop ([source](https://github.com/typeorm/typeorm/blob/master/src/util/ObjectUtils.ts)). Note that the source here is `{ ...otherProperties }`, the result of an object rest spread on `driverError`: spread only copies enumerable own keys, so any non-enumerable property on the underlying driver error is filtered out before `ObjectUtils.assign` ever sees it. Net effect on the wrapper is the same as `Object.assign` for the typical case.

Both reads return the same value, but only one is properly typed. The [`pg` package exports a `DatabaseError` class](https://github.com/brianc/node-postgres/blob/master/packages/pg-protocol/src/messages.ts) with `code`, `constraint`, `detail`, `table`, `column`, etc. (typed as `string | undefined`). Read through `err.driverError` and you get the official driver type with zero casts; read through `err.code` and you get `any`. Skip the augmentation type entirely:

```typescript
// db-errors.ts
import { DatabaseError } from "pg";
import { QueryFailedError } from "typeorm";

// SQLSTATE codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
export const PG = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  NOT_NULL_VIOLATION: "23502",
  CHECK_VIOLATION: "23514",
} as const;

/** Narrow `unknown` to a TypeORM-wrapped Postgres error. */
export function isPgError(err: unknown): err is QueryFailedError<DatabaseError> {
  return err instanceof QueryFailedError && err.driverError instanceof DatabaseError;
}

/** True iff `err` is a Postgres unique-violation, optionally matching a named constraint. */
export function isUniqueViolation(
  err: unknown,
  constraint?: string,
): err is QueryFailedError<DatabaseError> {
  if (!isPgError(err)) return false;
  if (err.driverError.code !== PG.UNIQUE_VIOLATION) return false;
  return constraint === undefined || err.driverError.constraint === constraint;
}
```

## Driver error code reference

| Constraint                                        | Postgres SQLSTATE | MySQL `errno`                           | SQLite extended code                 | Mapped by Recipe 1 (PG only)                                                                       |
| ------------------------------------------------- | ----------------- | --------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Unique                                            | `23505`           | `1062` (`ER_DUP_ENTRY`)                 | `SQLITE_CONSTRAINT_UNIQUE` (2067)    | [yes → 409 + named constraint](#recipe-1-centralize-in-an-exception-filter-recommended-for-nestjs) |
| Foreign key                                       | `23503`           | `1452` on insert, `1451` on delete      | `SQLITE_CONSTRAINT_FOREIGNKEY` (787) | [yes → 409](#recipe-1-centralize-in-an-exception-filter-recommended-for-nestjs)                    |
| Not null                                          | `23502`           | `1048` (`ER_BAD_NULL_ERROR`)            | `SQLITE_CONSTRAINT_NOTNULL` (1299)   | [yes → 422](#recipe-1-centralize-in-an-exception-filter-recommended-for-nestjs)                    |
| Check                                             | `23514`           | `3819` (`ER_CHECK_CONSTRAINT_VIOLATED`) | `SQLITE_CONSTRAINT_CHECK` (275)      | [yes → 422](#recipe-1-centralize-in-an-exception-filter-recommended-for-nestjs)                    |
| Exclusion (PG only)                               | `23P01`           | n/a                                     | n/a                                  | no, falls through to 500                                                                           |
| Concurrent-update conflict (retryable, txn-level) | `40001`           | `1213` (`ER_LOCK_DEADLOCK`)             | n/a                                  | no; see [Retryable errors](#gotchas)                                                               |

Postgres SQLSTATE values are stable across versions. `err.code` is a **string**; MySQL `err.errno` is a **number**. The SQLite column lists the _extended_ result codes; what `err.code` actually contains depends on the driver and on whether [extended result codes](https://www.sqlite.org/c3ref/extended_result_codes.html) are enabled. Check your driver's docs (e.g. [better-sqlite3](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) exposes the symbolic name). The recipe below targets Postgres only; adapt the predicate per driver if you need cross-DB support.

## Recipe 1: Centralize in an exception filter (recommended for NestJS)

One filter, registered globally, maps every database failure to the right HTTP status. Controllers just call `repository.save()` and let the filter translate.

```typescript
// typeorm-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { DatabaseError } from "pg";
import { QueryFailedError } from "typeorm";
import { isPgError, PG } from "./db-errors";

@Catch(QueryFailedError)
export class TypeOrmExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(TypeOrmExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    if (!isPgError(exception)) {
      super.catch(new InternalServerErrorException(), host);
      return;
    }
    const mapped = this.toHttp(exception.driverError);
    if (mapped instanceof InternalServerErrorException) {
      this.logger.error(
        `Unmapped DB error code=${exception.driverError.code} detail=${exception.driverError.detail}`,
        exception.stack,
      );
    }
    super.catch(mapped, host);
  }

  private toHttp(err: DatabaseError): HttpException {
    switch (err.code) {
      case PG.UNIQUE_VIOLATION:
        return new ConflictException({
          statusCode: 409,
          error: "DUPLICATE",
          constraint: err.constraint,
          detail: err.detail,
        });
      case PG.FOREIGN_KEY_VIOLATION:
        return new ConflictException({
          statusCode: 409,
          error: "FK_VIOLATION",
          constraint: err.constraint,
          detail: err.detail,
        });
      case PG.NOT_NULL_VIOLATION:
        return new UnprocessableEntityException({
          statusCode: 422,
          error: "NOT_NULL",
          column: err.column,
        });
      case PG.CHECK_VIOLATION:
        return new UnprocessableEntityException({
          statusCode: 422,
          error: "CHECK",
          constraint: err.constraint,
        });
      default:
        return new InternalServerErrorException();
    }
  }
}
```

Register globally:

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { TypeOrmExceptionFilter } from "./typeorm-exception.filter";

@Module({
  providers: [{ provide: APP_FILTER, useClass: TypeOrmExceptionFilter }],
})
export class AppModule {}
```

### What the client sees

Given a unique index on `users.email` (named `users_email_key`; see [Recipe 2](#recipe-2-catch-in-the-service-when-you-need-domain-context) for why naming matters), posting a duplicate email:

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

The filter approach is generic. When you need to attach domain meaning (e.g., "this specific unique violation means the email is taken; that one means the username is"), catch in the service. This requires **named** unique constraints so you can branch on `err.constraint`. TypeORM gives three ways to declare uniqueness, and only one of them is right for this job (decorator sources: [`@Unique`](https://github.com/typeorm/typeorm/blob/master/src/decorator/Unique.ts), [`@Index`](https://github.com/typeorm/typeorm/blob/master/src/decorator/Index.ts)):

| Decorator                                   | What TypeORM registers                     | What Postgres emits                       | Naming control             | Composite             |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------------- | -------------------------- | --------------------- |
| `@Column({ unique: true })`                 | a `uniques` metadata entry                 | `ADD CONSTRAINT "UQ_<hash>" UNIQUE (...)` | ❌ auto-named (`UQ_2e7b…`) | ❌ single column only |
| `@Unique('name', ['col'])` (class-level)    | a `uniques` metadata entry **with a name** | `ADD CONSTRAINT "name" UNIQUE (...)`      | ✅                         | ✅                    |
| `@Index('name', ['col'], { unique: true })` | an `indices` metadata entry                | `CREATE UNIQUE INDEX "name" ON ...`       | ✅                         | ✅                    |

Postgres enforces all three identically (a UNIQUE constraint is implemented via a unique index under the hood) and populates `err.constraint` for **all of them**: [the protocol spec](https://www.postgresql.org/docs/current/protocol-error-fields.html) explicitly says _"indexes are treated as constraints"_ for the constraint-name field. So the choice between `@Unique` and `@Index({ unique: true })` is not about whether `err.constraint` works (it does either way); it's about intent and metadata location: `@Unique` registers a constraint visible in [`pg_constraint`](https://www.postgresql.org/docs/current/catalog-pg-constraint.html), `@Index` only shows in [`pg_indexes`](https://www.postgresql.org/docs/current/view-pg-indexes.html). Use `@Unique` for "no two users with the same email": it matches the modeling intent. Use `@Index({ unique: true })` when you specifically need an index (e.g. partial uniqueness with a `WHERE` clause).

```typescript
// user.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
@Unique("users_email_key", ["email"])
@Unique("users_username_key", ["username"])
export class User {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() email!: string;
  @Column() username!: string;
}
```

With those names in place, the service can branch on `err.constraint`:

```typescript
// users.service.ts
import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { isUniqueViolation } from "./db-errors";
import { User } from "./user.entity";

// Map each named unique constraint to a domain error code.
const USER_CONFLICTS: Record<string, string> = {
  users_email_key: "EMAIL_TAKEN",
  users_username_key: "USERNAME_TAKEN",
};

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async create(data: Pick<User, "email" | "username">): Promise<User> {
    try {
      return await this.users.save(this.users.create(data));
    } catch (err: unknown) {
      if (isUniqueViolation(err) && err.driverError.constraint) {
        const code = USER_CONFLICTS[err.driverError.constraint];
        if (code) throw new ConflictException({ statusCode: 409, error: code });
      }
      throw err; // Re-throw; the global filter handles the rest.
    }
  }
}
```

Sample response for a duplicate email:

```json
{ "statusCode": 409, "error": "EMAIL_TAKEN" }
```

> [!warning]- `HttpException` does NOT auto-inject `statusCode` into object payloads
> When you pass an object to `new ConflictException({ ... })`, Nest's `BaseExceptionFilter` sends it as-is; only when you pass a string does it wrap it in `{ statusCode, message }`. So you have to put `statusCode` in the object yourself if you want it in the response body. Source: [`base-exception-filter.ts`](https://github.com/nestjs/nest/blob/master/packages/core/exceptions/base-exception-filter.ts) (`isObject(res) ? res : { statusCode, message: res }`).

## When to use which

| Approach                                | Use when                                                                 | Trade-off                                                            |
| --------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Global filter (Recipe 1)                | You want consistent JSON for every DB error across all controllers       | Generic messages; can't map "which unique" to "which domain meaning" |
| Service-level catch (Recipe 2)          | You need domain-specific error codes (`EMAIL_TAKEN` vs `USERNAME_TAKEN`) | Boilerplate per service; only handles the cases you explicitly catch |
| Both (recommended for non-trivial APIs) | Service catches the constraints it cares about; filter handles the rest  | Two layers, but each does one thing                                  |

## Gotchas

> [!warning]- Don't match on `err.message`
> Driver messages can change between versions and (on some drivers) vary with server locale settings. Always branch on `err.code` (Postgres SQLSTATE) or `err.errno` (MySQL).

> [!warning]- Driver props live in two places, by design
> `QueryFailedError`'s constructor spreads every enumerable own property of `driverError` (except `name`) onto the error instance via `ObjectUtils.assign` ([source: `QueryFailedError.ts`](https://github.com/typeorm/typeorm/blob/master/src/error/QueryFailedError.ts#L21-L31)), so `err.code` and `err.driverError.code` return the same value at runtime. **Read through `err.driverError`**: `pg` exports `DatabaseError` with all fields properly typed (`code`, `constraint`, `detail`, etc., as `string | undefined`). The flat copies on the wrapper are typed as `any` (TypeORM doesn't model them) and force casts.

> [!warning]- Transaction rollback is not automatic for non-`QueryRunner` errors
> If you `await dataSource.transaction(...)` and **throw** inside the callback, TypeORM rolls back. If you `try/catch` inside the callback and **don't re-throw**, the transaction commits with the broken state. Always re-throw after logging.

> [!info]- FK violations: 409 vs 422 depends on direction
> Recipe 1 maps `23503` to `409 Conflict` uniformly. That's right when the violation comes from a **delete** with surviving dependents (the resource state conflicts with the request). For an **insert** that references a missing parent, `422 Unprocessable Entity` (or `400`) is more accurate: the input is well-formed but semantically invalid. Postgres doesn't distinguish the two cases in the error code itself; if you care, branch on the operation in the service layer or inspect `err.detail` (which contains `Key (...)=(...) is not present in table "..."` for inserts vs `Key (...)=(...) is still referenced from table "..."` for deletes).

> [!info]- NOT NULL violations usually mean [[nestjs/recipes/validation|validation]] failed
> If `23502` reaches the database, your DTO validation didn't require the field. Returning `422` keeps the client contract sane, but log the violation at `warn` or `error`: it's a server-side gap, not a client bug. The [[nestjs/fundamentals/pipes|validation pipe]] should have caught it first.

> [!info]- Retryable errors
> Postgres `40001` (`serialization_failure`) and MySQL `1213` (deadlock) are recoverable: retry the transaction with backoff. Map them to a 503 with `Retry-After` rather than 500.

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
