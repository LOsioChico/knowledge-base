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
---

> Notes on the AWS CLI itself: how I configure it, drive multiple accounts from one shell, and shape its output into something a pipeline can read. Per-service command cheatsheets live alongside as `aws/cli/<service>.md`.

## CLI fundamentals

- [[aws/cli/profiles-and-credentials|Profiles and credentials]]: named profiles, `--profile`, `~/.aws/config`, `aws sts get-caller-identity` as the universal sanity check.
- [[aws/cli/query-and-output|Query and output]]: `--query` (JMESPath), `--output {json,table,text}`, picking shapes that survive in a script.

## Per-service cheatsheets

- [[aws/cli/s3|S3]]: `aws s3` and `aws s3api` for inventory, configuration, and bulk copies.
