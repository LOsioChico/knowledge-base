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

## TL;DR

- **Two queue types**. **Standard** = best-effort ordering, at-least-once delivery, near-unlimited throughput. **FIFO** = strict ordering + exactly-once processing within a `MessageGroupId`, capped throughput.
- **Pull, not push**. Consumers call `ReceiveMessage` and must `DeleteMessage` after success. Failure to delete = redelivery after the visibility timeout expires.
- **Visibility timeout** hides a message from other consumers while one is processing it. Tune it longer than your worst-case handler time, or extend it mid-flight.
- **Dead-letter queue (DLQ)**: a second queue that auto-receives messages that failed too many times. Always wire one up; without it, poison messages loop forever.
- **Pairs naturally with [[aws/sns/index|SNS]] (fan-out)** and [[aws/lambda/index|Lambda]]: an **event-source mapping** (Lambda's polling-trigger primitive) pulls from the queue and invokes the function.

## When to use

- **Use SQS** for: decoupling producers from consumers, smoothing traffic spikes, retry buffers, [[aws/s3/event-notifications|S3 event notifications]] that don't need every consumer to see every event.
- **Don't use SQS** for: fan-out to multiple consumers (use SNS or EventBridge, the AWS managed event bus for application and scheduled events); for ordering across all messages (use a single-shard FIFO group, but throughput is capped); for "stream replay" semantics (use Kinesis, AWS's managed partitioned event-stream service, or MSK (Managed Streaming for Apache Kafka)).

## Pending notes

- DLQ (dead-letter queue) wiring + redrive: how `maxReceiveCount` works and how to replay from the DLQ.
- Visibility-timeout pitfalls: what happens when the handler crashes vs when it just runs long.
- SNS → SQS fan-out pattern with raw message delivery enabled.

## See also

- [[aws/sns/index|SNS]]: pub/sub topic that fans out to many subscribers (often SQS queues).
- [Amazon SQS developer guide](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html) (official).
