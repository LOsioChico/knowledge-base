---
title: DynamoDB
aliases: [aws dynamodb, dynamo]
tags: [type/concept, tech/aws, tech/dynamodb]
area: aws
status: seed
related:
  - "[[aws/index]]"
source:
  - https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html
---

> Amazon DynamoDB is AWS's managed key-value + document database: you define a table with a partition key (and optional sort key), write items as JSON-shaped documents, and AWS handles sharding, replication, and per-millisecond auto-scaling. Single-digit-ms reads at any scale, no servers to provision.

## TL;DR

- **Schema = key shape only**. Partition key + optional sort key is the entire schema you commit to; every other attribute is per-item and free-form.
- **Access patterns drive design**. You query by key (or by GSI = global secondary index). There are no joins, no ad-hoc `WHERE`, no `LIKE`. Model the queries you'll run, not the entities.
- **Two capacity modes**. **On-demand** (pay per request, no planning) vs **provisioned** (cheaper at sustained throughput, requires capacity planning + auto-scaling).
- **Conditional writes are atomic per item**. The primitive that makes DynamoDB usable as a coordination layer (locks, idempotency keys, single-writer tables) for systems backed by [[aws/s3/index|S3]] or other storage without ordering.
- **Streams + TTL** are first-class: change-data-capture into [[aws/lambda/index|Lambda]]; per-item expiration without a sweeper job.

## When to use

- **Use DynamoDB** for: high-traffic key-value reads, session stores, idempotency tables, per-user JSON state, IoT (Internet of Things) telemetry write paths.
- **Don't use DynamoDB** for: ad-hoc analytics, joins across entities, anything that needs SQL: use [[aws/rds/index|RDS]] or Athena (the serverless SQL-on-S3 service) instead.
- **Don't use DynamoDB** when access patterns are unknown or volatile: re-modeling a hot DynamoDB table is much more painful than re-indexing a relational table.

## Pending notes

- Single-table design: one table per service, multiple entity types overlaid via composite keys.
- On-demand vs provisioned capacity: when each is cheaper.
- Conditional writes for idempotency: `attribute_not_exists` to dedupe at-least-once event handlers.
- DynamoDB Streams → [[aws/lambda/index|Lambda]] for change-data-capture; per-item TTL.

## See also

- [Amazon DynamoDB developer guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html) (official).
