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
---

> Amazon SNS (Simple Notification Service) is the managed pub/sub: a publisher pushes a message to a **topic**, every subscriber to that topic gets a copy. Subscribers can be [[aws/sqs/index|SQS]] queues, [[aws/lambda/index|Lambda]] functions, HTTP endpoints, email addresses, SMS, or mobile-push tokens.

This area is a placeholder.

## Pending notes

- Standard vs FIFO topics: throughput vs strict ordering + exactly-once.
- SNS → SQS fan-out with raw-message-delivery (skips the SNS envelope wrapping).
- Filter policies: per-subscription attribute matching to scope deliveries.
- HTTP/HTTPS endpoint subscription confirmation handshake.

## See also

- [[aws/sqs/index|SQS]]: the queue most often paired with SNS for fan-out.
- [Amazon SNS developer guide](https://docs.aws.amazon.com/sns/latest/dg/welcome.html) (official).
