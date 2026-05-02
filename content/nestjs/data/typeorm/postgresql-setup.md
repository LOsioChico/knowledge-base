---
title: PostgreSQL setup with TypeORM
aliases:
  [
    typeorm postgres,
    typeorm postgresql,
    nestjs postgres connection,
    TypeOrmModule forRoot,
    TypeOrmModule forRootAsync,
    autoLoadEntities,
    typeorm migrations,
  ]
tags: [type/recipe, tech/typeorm, tech/postgres]
area: nestjs
status: evergreen
related:
  - "[[nestjs/data/typeorm/index]]"
  - "[[nestjs/data/typeorm/handle-database-errors]]"
source:
  - https://docs.nestjs.com/techniques/database
  - https://docs.nestjs.com/techniques/configuration
  - https://typeorm.io/data-source-options
  - https://typeorm.io/data-source
  - https://typeorm.io/migrations
  - https://node-postgres.com/
  - https://github.com/nestjs/typeorm
  - https://github.com/nestjs/typeorm/blob/master/lib/interfaces/typeorm-options.interface.ts
  - https://github.com/nestjs/typeorm/blob/master/lib/typeorm-core.module.ts
  - https://github.com/nestjs/config/blob/master/lib/config.service.ts
  - https://github.com/typeorm/typeorm/blob/master/src/driver/postgres/PostgresDriver.ts
  - https://github.com/typeorm/typeorm/blob/master/src/migration/MigrationExecutor.ts
  - https://www.telerik.com/blogs/learning-nestjs-part-2-connecting-database
---

> Wire `@nestjs/typeorm` to a Postgres database via `forRootAsync` + `ConfigService`, register entities per feature, inject repositories, and run migrations from a standalone `DataSource`. One `forRoot` per process; `forFeature` per module.

## Setup

```bash
npm install @nestjs/typeorm typeorm pg
npm install --save-dev @types/pg
```

`pg` is the [Postgres driver](https://node-postgres.com/) TypeORM picks up automatically when `type: 'postgres'` is set. `@nestjs/typeorm` provides the Nest module wrappers (`TypeOrmModule.forRoot`, `forRootAsync`, `forFeature`) and the `@InjectRepository`, `@InjectDataSource`, `@InjectEntityManager`, `getRepositoryToken` helpers.

## Step 1: Quick-start with `forRoot` (hardcoded)

The smallest possible setup. Useful as a smoke test; replace with `forRootAsync` before you commit anything.

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "postgres",
      password: "postgres",
      database: "app",
      autoLoadEntities: true,
      synchronize: true, // dev only — see gotcha below
    }),
  ],
})
export class AppModule {}
```

Run a Postgres container next to the app for local dev:

```bash
docker run --rm -d --name pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app \
  -p 5432:5432 postgres:16
```

> [!warning]- Never ship `synchronize: true`
> `synchronize: true` re-derives the schema from your entity decorators on every boot and runs `ALTER TABLE` statements to match. In production this drops columns, recreates indexes, and silently destroys data. Use it during the first day of a feature, then disable it and switch to migrations (see [Step 5](#step-5-migrations-from-a-standalone-datasource)).

## Step 2: `forRootAsync` with `ConfigService` and env checks

Move the credentials to env, check their shape at boot with a Joi schema, and inject the config.

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import * as Joi from "joi";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_HOST: Joi.string().required(),
        DATABASE_PORT: Joi.number().default(5432),
        DATABASE_USER: Joi.string().required(),
        DATABASE_PASSWORD: Joi.string().required(),
        DATABASE_NAME: Joi.string().required(),
        DATABASE_SSL: Joi.boolean().default(false),
        NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.getOrThrow<string>("DATABASE_HOST"),
        port: config.getOrThrow<number>("DATABASE_PORT"),
        username: config.getOrThrow<string>("DATABASE_USER"),
        password: config.getOrThrow<string>("DATABASE_PASSWORD"),
        database: config.getOrThrow<string>("DATABASE_NAME"),
        ssl: config.get<boolean>("DATABASE_SSL") ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: config.get("NODE_ENV") === "production",
      }),
    }),
  ],
})
export class AppModule {}
```

[`ConfigService.getOrThrow`](https://github.com/nestjs/config/blob/master/lib/config.service.ts) fails fast at boot if a key is missing, so you don't ship an app that crashes on the first query. Joi's `validationSchema` runs as part of `ConfigModule.forRoot()` so a typo in `.env` blocks startup with a readable error instead of a connection timeout three seconds later (see [Configuration → Schema validation](https://docs.nestjs.com/techniques/configuration#schema-validation)).

`migrationsRun: true` runs pending migrations on boot. Convenient for production; in dev, run them manually with the CLI so you control timing.

## Step 3: Define entities and register them per feature

`forRoot` provides the connection. `forFeature` declares which entities each feature module owns and emits a `Repository<Entity>` provider you can inject.

```typescript
// users/user.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({ name: "users" })
@Unique("users_email_key", ["email"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  email!: string;

  @Column()
  name!: string;

  @Column({ default: true })
  isActive!: boolean;
}
```

```typescript
// users/users.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { User } from "./user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

Then import `UsersModule` from `AppModule`'s `imports`.

`autoLoadEntities: true` (set in Step 2) tells `@nestjs/typeorm` to collect every entity passed to any `forFeature` call and add it to the connection's `entities` array automatically. Without it, you'd need to maintain an `entities: [User, Post, ...]` list on `forRoot` and re-import every domain class into the root module, which leaks domain boundaries.

> [!warning]- `autoLoadEntities` does NOT include unregistered relation targets
> If `User` has `@OneToMany(() => Post, ...)` but no module ever calls `TypeOrmModule.forFeature([Post])`, `Post` is **not** loaded: TypeORM will throw "Entity metadata for User#posts was not found" at startup. Either register `Post` in some `forFeature` (even a module that doesn't use the repository) or fall back to an explicit `entities` array. Source: [docs.nestjs.com/techniques/database#auto-load-entities](https://docs.nestjs.com/techniques/database#auto-load-entities).

## Step 4: Repository pattern and CRUD

Inject the repository with `@InjectRepository(Entity)`. The token under the hood is `getRepositoryToken(User)`: useful for mocking in tests.

```typescript
// users/users.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./user.entity";

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  create(data: Pick<User, "email" | "name">): Promise<User> {
    return this.users.save(this.users.create(data));
  }

  findAll(): Promise<User[]> {
    return this.users.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.users.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.users.delete(id);
    if (!result.affected) throw new NotFoundException(`User ${id} not found`);
  }
}
```

```typescript
// users/users.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { User } from "./user.entity";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  create(@Body() body: Pick<User, "email" | "name">): Promise<User> {
    return this.users.create(body);
  }

  @Get()
  findAll(): Promise<User[]> {
    return this.users.findAll();
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<User> {
    return this.users.findOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() body: Partial<User>): Promise<User> {
    return this.users.update(id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.users.remove(id);
  }
}
```

### What the client sees

```http
POST /users
Content-Type: application/json

{ "email": "ada@example.com", "name": "Ada" }
```

```json
{
  "id": "5b1d6f3a-9c1f-4e1e-9a7e-8c6b1f0a2c3d",
  "email": "ada@example.com",
  "name": "Ada",
  "isActive": true
}
```

A duplicate email surfaces as Postgres SQLSTATE [`23505` (unique_violation)](https://www.postgresql.org/docs/current/errcodes-appendix.html) wrapped in `QueryFailedError`. Handle it centrally with the filter from [[nestjs/data/typeorm/handle-database-errors|handle database errors]]: don't try/catch in every controller.

## Step 5: Migrations from a standalone `DataSource`

Migrations live outside the Nest DI container. The TypeORM CLI needs its own `DataSource` instance, exported from a regular `.ts` file, with no Nest decorators around it.

```typescript
// src/data-source.ts
import "dotenv/config";
import { DataSource } from "typeorm";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST!,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER!,
  password: process.env.DATABASE_PASSWORD!,
  database: process.env.DATABASE_NAME!,
  entities: ["src/**/*.entity.{ts,js}"],
  migrations: ["src/migrations/*.{ts,js}"],
  synchronize: false,
  migrationsTableName: "typeorm_migrations",
});
```

Add CLI scripts. The TypeORM CLI runs under `ts-node` so it can read `.ts` entity files without a build step.

```jsonc
// package.json (excerpt)
{
  "scripts": {
    "typeorm": "typeorm-ts-node-commonjs -d src/data-source.ts",
    "migration:generate": "npm run typeorm -- migration:generate",
    "migration:create": "npm run typeorm -- migration:create",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert",
  },
}
```

Generate a migration from the diff between current entities and the live database:

```bash
npm run migration:generate -- src/migrations/AddUsers
```

Run pending migrations:

```bash
npm run migration:run
```

The Nest app and the CLI are now two separate `DataSource` definitions pointing at the same database. They have to stay in sync (host, port, credentials, `migrationsTableName`); a config drift between them is a common foot-gun. Pull the connection options into a shared factory:

```typescript
// src/db-options.ts
import { DataSourceOptions } from "typeorm";

export function dbOptions(): DataSourceOptions {
  return {
    type: "postgres",
    host: process.env.DATABASE_HOST!,
    port: Number(process.env.DATABASE_PORT ?? 5432),
    username: process.env.DATABASE_USER!,
    password: process.env.DATABASE_PASSWORD!,
    database: process.env.DATABASE_NAME!,
    migrations: ["dist/migrations/*.js"],
    migrationsTableName: "typeorm_migrations",
  };
}
```

Both `data-source.ts` (CLI) and the `forRootAsync` factory (Nest) call `dbOptions()` and add their context-specific extras (`entities` for the CLI, `autoLoadEntities` for Nest).

## Common configuration options

| Option                | Purpose                               | Default                             | When to change                                                                                                                |
| --------------------- | ------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `type`                | Driver dialect                        | required                            | Use `"postgres"` for Postgres; `pg` is auto-loaded                                                                            |
| `host` / `port`       | TCP target                            | required                            | Change per env                                                                                                                |
| `ssl`                 | TLS to the server                     | `false`                             | Set to `{ rejectUnauthorized: false }` for managed Postgres (RDS, Supabase, Neon) with self-signed certs; tighten for prod    |
| `synchronize`         | Auto-derive schema from entities      | `false`                             | Dev-only, never prod (see [Step 1 warning](#step-1-quick-start-with-forroot-hardcoded))                                       |
| `autoLoadEntities`    | Pull entities from `forFeature` calls | `false`                             | Almost always `true`; see [Step 3 warning](#step-3-define-entities-and-register-them-per-feature) for the relation-target gap |
| `migrations`          | Glob for migration files              | `[]`                                | Required if you use `migrationsRun` or the CLI                                                                                |
| `migrationsRun`       | Run pending migrations on boot        | `false`                             | `true` in production; `false` in dev (run manually)                                                                           |
| `migrationsTableName` | Table that records applied migrations | `"migrations"`                      | Rename if you have multiple apps sharing one schema                                                                           |
| `retryAttempts`       | Connection retry count                | `10`                                | Lower in tests for faster failure                                                                                             |
| `retryDelay`          | Delay between retries (ms)            | `3000`                              |                                                                                                                               |
| `logging`             | Query logging                         | `false`                             | `["error", "warn"]` is a good prod baseline; `true` in dev                                                                    |
| `namingStrategy`      | Column/table name conventions         | TypeORM default (camelCase columns) | Set to `SnakeNamingStrategy` from `typeorm-naming-strategies` if you want `snake_case` columns                                |

`forRoot` accepts every option from the underlying TypeORM `DataSourceOptions`, plus a handful of NestJS-specific extras (`name`, `retryAttempts`, `retryDelay`, `toRetry`, `verboseRetryLog`, `autoLoadEntities`, `manualInitialization`) defined in the [`TypeOrmModuleOptions` interface](https://github.com/nestjs/typeorm/blob/master/lib/interfaces/typeorm-options.interface.ts). See the [data source options reference](https://typeorm.io/data-source-options) for the per-dialect TypeORM list.

## Gotchas

> [!warning]- One `forRoot`, many `forFeature`
> Call `TypeOrmModule.forRoot(...)` exactly once, in `AppModule` (or a dedicated `DatabaseModule`). Each feature module calls `TypeOrmModule.forFeature([Entity])` to register its repositories. `@nestjs/typeorm` tracks each connection via a `DataSourceNameRegistry` ([typeorm-core.module.ts](https://github.com/nestjs/typeorm/blob/master/lib/typeorm-core.module.ts)); calling `forRoot` twice for the **same** connection name registers two roots against the same key and surfaces as a startup error. For multiple databases, give each connection a `name` and pass that name to `forFeature(entities, name)`.

> [!warning]- `Repository` outside its module
> A repository registered via `forFeature([User])` is only visible inside that module. To use `@InjectRepository(User)` in a different module, the owning module has to `exports: [TypeOrmModule]` (the whole `TypeOrmModule`, not just `User`). Source: [docs.nestjs.com/techniques/database#repository-pattern](https://docs.nestjs.com/techniques/database#repository-pattern).

> [!warning]- `synchronize` and migrations don't mix
> If `synchronize: true` runs alongside migrations, the schema is mutated by the synchronize pass on every boot, so migration history no longer matches what's in the database. The TypeORM docs warn against using `synchronize` outside development for exactly this reason ([Synchronization](https://typeorm.io/data-source-options#common-data-source-options) entry: "do not use ... in production"). Pick one strategy per environment.

> [!info]- `pg` driver vs `postgres` (`postgres.js`)
> TypeORM's Postgres driver loads `require("pg")` ([source](https://github.com/typeorm/typeorm/blob/master/src/driver/postgres/PostgresDriver.ts)), not the newer [`postgres.js`](https://github.com/porsager/postgres). Installing `postgres` does nothing for TypeORM. The `@types/pg` dev dependency is what gives you the typed `DatabaseError` used in [[nestjs/data/typeorm/handle-database-errors|handle database errors]].

> [!info]- Connection pool sizing lives under `extra`
> `pg`-specific options (pool size, idle timeout, statement timeout) are passed through `extra`:
>
> ```typescript
> TypeOrmModule.forRoot({
>   type: "postgres",
>   // ...
>   extra: {
>     max: 20, // pool size
>     idleTimeoutMillis: 30_000,
>     statement_timeout: 5_000,
>   },
> });
> ```
>
> See [node-postgres pool docs](https://node-postgres.com/apis/pool) for the full list.

> [!info]- `EntityNotFoundError` vs `QueryFailedError`
> `repository.findOneOrFail()` throws [`EntityNotFoundError`](https://github.com/typeorm/typeorm/blob/master/src/error/EntityNotFoundError.ts), which is **not** a `QueryFailedError` and won't be caught by the database-error filter. Either use `findOne` + a manual `NotFoundException` (as in Step 4) or add a second `@Catch(EntityNotFoundError)` filter that maps to 404.

> [!todo]- Verify on TypeORM 0.4 release
> `forRootAsync` factory shape and `autoLoadEntities` semantics have been stable through TypeORM 0.3.x and `@nestjs/typeorm` 10.x. Re-check on the next major.

## See also

- [[nestjs/data/typeorm/handle-database-errors|Handle database errors]]: map `QueryFailedError` to HTTP responses once the connection is live.
- [[nestjs/data/typeorm/index|TypeORM MOC]]: pending notes on transactions, custom repositories, and relations.
- [NestJS database techniques](https://docs.nestjs.com/techniques/database): canonical reference for `TypeOrmModule` options.
- [TypeORM data source options](https://typeorm.io/data-source-options): every option `forRoot` accepts, per dialect.
- [TypeORM migrations](https://typeorm.io/migrations): generating, running, and reverting migrations from the CLI.
- [Telerik: Learning NestJS Part 2: Connecting to Database](https://www.telerik.com/blogs/learning-nestjs-part-2-connecting-database): walkthrough-style alternative covering CRUD endpoints with `@Res()`-style controllers (this note prefers Nest's default response handling).
