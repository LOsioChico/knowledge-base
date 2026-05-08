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
  - "[[aws/s3/quickstart]]"
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

## TL;DR

- **Function = deployment unit**: code + dependencies + config (memory, timeout, env vars), shipped as a zip or container image.
- **Execution role** is the [[aws/iam/index|IAM]] role the function runs as: every AWS API call from your handler uses these credentials.
- **Triggers** invoke the function: API Gateway, SQS/SNS/[[aws/s3/event-notifications|S3 events]], EventBridge, Function URL, direct invoke. Each trigger is its own resource with its own permission grant.
- **Versions are immutable; aliases are re-pointable.** Wire triggers to aliases (`prod`, `staging`) so you can flip traffic without touching the trigger.
- **Pricing** is per invocation + GB-second. CPU scales linearly with the `MemorySize` setting (more memory = more CPU).

## When to use

- **Use Lambda** for: event-driven glue, scheduled jobs, webhooks, S3-trigger-style processing, anything that benefits from scale-to-zero.
- **Don't use Lambda** for: long-running workloads (15-minute hard cap), latency-critical paths where cold starts hurt, or anything that needs persistent local state.

## Mental model

| Piece                        | What it controls                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Function**                 | The named unit. Has a runtime, a handler, code (zip or container image), env vars.                                                                                            |
| **Execution role**           | [[aws/iam/index\|IAM]] role the function runs as. This is what calls to other AWS services use.                                                                               |
| **Triggers / event sources** | What invokes the function (API Gateway, SQS, S3 event, EventBridge, Function URL, direct invoke).                                                                             |
| **Versions + aliases**       | Versions are immutable snapshots; aliases are re-pointable names. Wire aliases (`prod`, `staging`) into triggers so you can flip traffic without touching the trigger itself. |

## Pending notes

- Cross-account Lambda migration: package, recreate function, repoint event sources, swap aliases for zero-downtime cutover.
- Region-pinned `AccessDenied`: when `aws lambda list-functions --region <r>` fails on one Region but works on another, what to check first.
- Cold-start triage: what `Init Duration` in CloudWatch Logs actually measures and which knobs (provisioned concurrency, SnapStart, smaller package) move it.

## See also

- [[aws/lambda/cli|Lambda CLI cheatsheet]]: function lifecycle and invocation commands.
- [AWS Lambda developer guide](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) (official).
