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

## Mental model

A **Lambda function** is a deployment unit (code + dependencies + config) that runs inside a short-lived **execution environment** managed by AWS. You don't see the host. AWS sizes the environment based on your `MemorySize` setting (CPU scales linearly with memory) and reuses it across invocations until it goes cold.

The pieces:

| Piece                        | What it controls                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Function**                 | The named unit. Has a runtime, a handler, code (zip or container image), env vars.                                                                                                         |
| **Execution role**           | [[aws/iam/index\|IAM]] role the function runs as. This is what calls to other AWS services use.                                                                                            |
| **Triggers / event sources** | What invokes the function (API Gateway, SQS, S3 event, EventBridge (managed event bus), Function URL, direct invoke).                                                                      |
| **Versions + aliases**       | Versions are immutable snapshots of the function; aliases are re-pointable names. Use aliases (`prod`, `staging`) in triggers so you can flip traffic without touching the trigger itself. |

## Pending notes

This area is a placeholder. Recipes I plan to write when I next touch Lambda:

- Cross-account Lambda migration: package, recreate function, repoint event sources, swap aliases for zero-downtime cutover.
- Region-pinned `AccessDenied`: when `aws lambda list-functions --region <r>` fails on one Region but works on another, what to check first (a service control policy boundary, an account-level deny, an expired IAM Identity Center / SSO session).
- Cold-start triage: what `Init Duration` in CloudWatch Logs actually measures and which knobs (provisioned concurrency, SnapStart (Lambda's init-snapshot feature for faster cold starts), smaller deployment package) move it.

## See also

- [[aws/lambda/cli|Lambda CLI cheatsheet]]: function lifecycle and invocation commands.
- [AWS Lambda developer guide](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) (official).
