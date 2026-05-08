---
title: SQS
aliases: [aws sqs, simple queue service]
tags: [type/concept, tech/aws, tech/sqs]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/sns/index]]"
  - "[[aws/lambda/index]]"
  - "[[aws/s3/event-notifications]]"
source:
  - https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html
---

> Amazon SQS (Simple Queue Service) is the managed message queue: a producer puts a message on a queue, a consumer pulls it, processes it, and deletes it. Two queue flavors (Standard and FIFO) trade ordering against throughput; AWS handles durability, retention, and scaling.

This area is a placeholder.

## Pending notes

- Standard vs FIFO queues: best-effort vs strict ordering, throughput trade-offs.
- Visibility timeout pitfalls: what happens when the handler crashes vs when it just runs long.
- Dead-letter queue (DLQ) wiring + redrive: how `maxReceiveCount` works and how to replay from the DLQ.
- [[aws/sns/index|SNS]] → SQS fan-out pattern with raw message delivery enabled.

## See also

- [[aws/sns/index|SNS]]: pub/sub topic that fans out to many subscribers (often SQS queues).
- [Amazon SQS developer guide](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html) (official).
