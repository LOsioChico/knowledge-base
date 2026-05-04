---
title: TypeORM
aliases: [typeorm, type-orm, nestjs typeorm]
tags: [type/moc, tech/typeorm]
area: nestjs
status: evergreen
related:
  - "[[nestjs/index]]"
  - "[[nestjs/data/typeorm/handle-database-errors]]"
  - "[[nestjs/data/typeorm/postgresql-setup]]"
source:
---

NestJS + TypeORM patterns: integration glue (`TypeOrmModule`, `@InjectRepository`), error handling, and gotchas specific to running TypeORM under Nest's DI container.

## Available

- [[nestjs/data/typeorm/postgresql-setup|PostgreSQL setup with TypeORM]]: connection, entities, repositories, CRUD, migrations
- [[nestjs/data/typeorm/handle-database-errors|Handle database errors (unique, FK, check)]]

## Pending

- Transactions: `dataSource.transaction()` vs `@Transactional` decorators
- Relations and eager/lazy loading
- Query builder patterns
- Custom repositories
