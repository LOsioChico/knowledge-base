---
title: Lambda
aliases: [aws lambda]
tags: [type/concept, tech/aws, tech/lambda]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/lambda/cli]]"
  - "[[aws/iam/index]]"
  - "[[aws/amplify/index]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
  - "[[aws/s3/index]]"
  - "[[aws/s3/event-notifications]]"
  - "[[aws/s3/presigned-urls]]"
  - "[[aws/secrets-manager]]"
  - "[[aws/sqs/index]]"
  - "[[aws/sns/index]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/lambda/latest/dg/welcome.html
---

> AWS Lambda is the "give me a function, I'll run it on demand" compute primitive: you ship code + a handler name + a runtime, AWS provisions and tears down execution environments to match incoming requests, and you pay per invocation + GB-second (gigabytes of memory × seconds of execution time).

This area is a placeholder. The day-to-day commands live in [[aws/lambda/cli|Lambda CLI cheatsheet]].

## Pending notes

- Cross-account Lambda migration: package, recreate function, repoint event sources, swap aliases for zero-downtime cutover.
- Region-pinned `AccessDenied`: when `aws lambda list-functions --region <r>` fails on one Region but works on another, what to check first.
- Cold-start triage: what `Init Duration` in CloudWatch Logs actually measures and which knobs (provisioned concurrency, SnapStart, smaller package) move it.

## See also

- [[aws/lambda/cli|Lambda CLI cheatsheet]]: function lifecycle and invocation commands.
- [AWS Lambda developer guide](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) (official).
