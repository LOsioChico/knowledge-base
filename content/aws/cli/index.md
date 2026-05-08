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
  - "[[aws/s3/cli]]"
  - "[[aws/iam/cli]]"
  - "[[aws/rds/cli]]"
  - "[[aws/cloudfront/cli]]"
  - "[[aws/amplify/cli]]"
  - "[[aws/kms/cli]]"
  - "[[aws/lambda/cli]]"
---

> Notes on the AWS CLI itself: how I configure it, drive multiple accounts from one shell, and shape its output into something a pipeline can read. Per-service command cheatsheets live next to each service note as `aws/<service>/cli.md`.

## CLI fundamentals

- [[aws/cli/profiles-and-credentials|Profiles and credentials]]: named profiles, `--profile`, `~/.aws/config`, `aws sts get-caller-identity` as the universal sanity check.
- [[aws/cli/query-and-output|Query and output]]: `--query` (uses JMESPath, AWS CLI's JSON query language), `--output {json,table,text}`, picking shapes that survive in a script.

## Per-service cheatsheets

- [[aws/s3/cli|S3]]: `aws s3` and `aws s3api` for inventory, configuration, and bulk copies.
- [[aws/iam/index|IAM]] / [[aws/iam/cli|cheatsheet]]: read-only diagnostics for `AccessDenied` triage.
- [[aws/rds/index|RDS]] / [[aws/rds/cli|cheatsheet]]: snapshot lifecycle, restore, instance state.
- [[aws/cloudfront/index|CloudFront]] / [[aws/cloudfront/cli|cheatsheet]]: distribution lookup, invalidation, alias inspection.
- [[aws/amplify/index|Amplify Hosting]] / [[aws/amplify/cli|cheatsheet]]: app, branch, deployment, and domain commands.
- [[aws/kms/index|KMS]] / [[aws/kms/cli|cheatsheet]]: create, alias, key-policy, schedule-deletion.
- [[aws/lambda/index|Lambda]] / [[aws/lambda/cli|cheatsheet]]: function lifecycle and invocation.
