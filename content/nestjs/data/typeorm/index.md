---
title: TypeORM
aliases: [typeorm, type-orm, nestjs typeorm]
tags: [type/moc, tech/typeorm]
area: nestjs
status: evergreen
related:
  - "[[nestjs/index]]"
  - "[[nestjs/data/typeorm/handle-database-errors]]"
source:
  - https://docs.nestjs.com/techniques/database
  - https://typeorm.io
---

NestJS + TypeORM patterns: integration glue (`TypeOrmModule`, `@InjectRepository`), error handling, and gotchas specific to running TypeORM under Nest's DI container.

## Available

- [[nestjs/data/typeorm/handle-database-errors|Handle database errors (unique, FK, check)]]

## Pending

- `TypeOrmModule.forRoot` setup with config checks
- `@InjectRepository` and custom repositories
- Transactions: `dataSource.transaction()` vs `@Transactional` decorators
- Relations and eager/lazy loading
- Query builder patterns
- Migrations workflow
