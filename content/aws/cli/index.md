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
---

Notes on the AWS CLI itself: how I configure it, drive multiple accounts from one shell, and shape its output into something a pipeline can read.

## Notes

- [[aws/cli/profiles-and-credentials|Profiles and credentials]]: named profiles, `--profile`, `~/.aws/config`, `aws sts get-caller-identity` as the universal sanity check.
- [[aws/cli/query-and-output|Query and output]]: `--query` (JMESPath), `--output {json,table,text}`, picking shapes that survive in a script.
