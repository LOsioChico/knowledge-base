---
title: AWS
aliases: [aws notes, amazon web services]
tags: [type/moc, tech/aws]
area: aws
status: evergreen
related:
  - "[[index]]"
  - "[[aws/cli/index]]"
  - "[[aws/recipes/index]]"
  - "[[aws/iam/index]]"
  - "[[aws/rds/index]]"
  - "[[aws/cloudfront/index]]"
  - "[[aws/amplify/index]]"
  - "[[aws/s3]]"
  - "[[aws/kms/index]]"
  - "[[aws/lambda/index]]"
  - "[[aws/migrations/index]]"
---

> Map of content for AWS. Service notes (`aws/<service>.md` once converted) explain what each service is, how it works, and when to use it; CLI cheatsheets for the same services live under [[aws/cli/index|aws/cli]]; cross-cutting recipes live under [[aws/recipes/index|aws/recipes]]. Folders that still hold an `index.md` are pre-restructure leftovers and will collapse into the same shape as files land.

## Foundations

- [[aws/cli/index|AWS CLI]]: profiles, credentials, `--query`, `--output`, JMESPath patterns I reach for. Per-service cheatsheets live alongside (e.g. [[aws/cli/s3|S3 CLI cheatsheet]]).

## Services

- [[aws/s3|S3]]: object storage. Buckets, keys, consistency model, default privacy.
- [[aws/iam/index|IAM]]: identities, roles, cross-account trust, permission diagnosis.
- [[aws/rds/index|RDS]]: relational databases, snapshots, cross-account moves.
- [[aws/cloudfront/index|CloudFront]]: distributions, alternate domain names, ACM wiring.
- [[aws/amplify/index|Amplify Hosting]]: app, branch, deployment, domain associations.
- [[aws/kms/index|KMS]]: customer-managed keys, key policies, cross-account grants.
- [[aws/lambda/index|Lambda]]: functions, deployments, region pinning.

## Recipes

- [[aws/recipes/index|AWS recipes]]: end-to-end procedures that touch more than one service or don't fit cleanly inside a single service note.

## Cross-cutting workflows

- [[aws/migrations/index|Account migrations]]: end-to-end Simplica → we4labs migration playbook covering RDS, IAM, S3, Amplify and CloudFront in a single narrative, with the per-service recipes linked from each step.

## When to read this area

- You're planning a multi-service migration between AWS accounts.
- A specific service is quarantined and you need to evacuate while leaving healthy services in place.
- A second AWS account is taking over an existing workload and you need to keep the same DNS, data, and permissions wiring.
