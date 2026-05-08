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

This area is a placeholder.

## Pending notes

- Schema = key shape only: partition key + optional sort key is everything you commit to.
- Single-table design: one table per service, multiple entity types overlaid via composite keys.
- On-demand vs provisioned capacity: when each is cheaper.
- Conditional writes for idempotency: `attribute_not_exists` to dedupe at-least-once event handlers.
- DynamoDB Streams → [[aws/lambda/index|Lambda]] for change-data-capture; per-item TTL.

## See also

- [Amazon DynamoDB developer guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html) (official).
