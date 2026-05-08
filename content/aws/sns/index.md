---
title: SNS
aliases: [aws sns, simple notification service]
tags: [type/concept, tech/aws, tech/sns]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/sqs/index]]"
  - "[[aws/lambda/index]]"
  - "[[aws/s3/event-notifications]]"
source:
  - https://docs.aws.amazon.com/sns/latest/dg/welcome.html
  - https://docs.aws.amazon.com/sns/latest/dg/sns-common-scenarios.html
---

> Amazon SNS (Simple Notification Service) is the managed pub/sub: a publisher pushes a message to a **topic**, every subscriber to that topic gets a copy. Subscribers can be [[aws/sqs/index|SQS]] queues, [[aws/lambda/index|Lambda]] functions, HTTP endpoints, email addresses, SMS, or mobile-push tokens.

## TL;DR

- **Push, not pull**. Once a message is published, SNS delivers it to every active subscription with retry; subscribers don't poll.
- **Two topic types**. **Standard** = at-least-once, no ordering, very high throughput. **FIFO** = strict ordering, exactly-once delivery, only delivers to FIFO SQS queues or HTTPS endpoints.
- **Fan-out is the canonical pattern**: SNS topic → multiple SQS queues, each consumed by a different service. Decouples producer from N independent consumers.
- **Filter policies** let each subscription receive only the messages whose attributes match its policy. Avoids "every consumer sees every event" waste.
- **HTTP/HTTPS endpoints** must respond to a one-time subscription confirmation. Mobile-push tokens and email subscriptions confirm out-of-band.

## When to use

- **Use SNS** for: fan-out to multiple consumers, mobile push notifications, email alerts, simple webhooks-out-of-AWS.
- **Use SNS + SQS together** for fan-out where each consumer needs its own buffered queue with retry + DLQ semantics. SNS delivers a copy to each queue; each queue can be processed independently.
- **Don't use SNS** for: ordered event streams (use Kinesis), large payload delivery (256 KB message size limit), or anything that needs replay.

## Pending notes

This area is a placeholder. Things I plan to write when I next touch SNS:

- SNS → SQS fan-out with raw-message-delivery (skips the SNS envelope wrapping).
- Filter policies: per-subscription attribute matching to scope deliveries.
- FIFO topics + FIFO queues: when strict ordering is worth the throughput ceiling.

## See also

- [[aws/sqs/index|SQS]]: the queue most often paired with SNS for fan-out.
- [Amazon SNS developer guide](https://docs.aws.amazon.com/sns/latest/dg/welcome.html) (official).
