---
title: AWS CLI
aliases: [aws cli, aws-cli]
tags: [type/moc, tech/aws, tech/aws-cli]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/cli/query-and-output]]"
  - "[[aws/cli/s3]]"
  - "[[aws/cli/iam-cheatsheet]]"
  - "[[aws/cli/rds-cheatsheet]]"
  - "[[aws/cli/cloudfront-cheatsheet]]"
  - "[[aws/cli/amplify-cheatsheet]]"
  - "[[aws/cli/kms-cheatsheet]]"
  - "[[aws/cli/lambda-cheatsheet]]"
---

> Notes on the AWS CLI itself: how I configure it, drive multiple accounts from one shell, and shape its output into something a pipeline can read. Per-service command cheatsheets live alongside as `aws/cli/<service>.md`.

## CLI fundamentals

- [[aws/cli/profiles-and-credentials|Profiles and credentials]]: named profiles, `--profile`, `~/.aws/config`, `aws sts get-caller-identity` as the universal sanity check.
- [[aws/cli/query-and-output|Query and output]]: `--query` (uses JMESPath, AWS CLI's JSON query language), `--output {json,table,text}`, picking shapes that survive in a script.

## Per-service cheatsheets

- [[aws/cli/s3|S3]]: `aws s3` and `aws s3api` for inventory, configuration, and bulk copies.
- [[aws/iam|IAM]] / [[aws/cli/iam-cheatsheet|cheatsheet]]: read-only diagnostics for `AccessDenied` triage.
- [[aws/rds|RDS]] / [[aws/cli/rds-cheatsheet|cheatsheet]]: snapshot lifecycle, restore, instance state.
- [[aws/cloudfront|CloudFront]] / [[aws/cli/cloudfront-cheatsheet|cheatsheet]]: distribution lookup, invalidation, alias inspection.
- [[aws/amplify|Amplify Hosting]] / [[aws/cli/amplify-cheatsheet|cheatsheet]]: app, branch, deployment, and domain commands.
- [[aws/kms|KMS]] / [[aws/cli/kms-cheatsheet|cheatsheet]]: create, alias, key-policy, schedule-deletion.
- [[aws/lambda|Lambda]] / [[aws/cli/lambda-cheatsheet|cheatsheet]]: function lifecycle and invocation.
