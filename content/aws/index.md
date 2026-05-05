---
title: AWS
aliases: [aws notes, amazon web services]
tags: [type/moc, tech/aws]
area: aws
status: evergreen
related:
  - "[[index]]"
  - "[[aws/cli/index]]"
  - "[[aws/iam/index]]"
  - "[[aws/rds/index]]"
  - "[[aws/cloudfront/index]]"
  - "[[aws/amplify/index]]"
  - "[[aws/s3/index]]"
  - "[[aws/kms/index]]"
  - "[[aws/lambda/index]]"
  - "[[aws/migrations/index]]"
---

Map of content for AWS. Organized by service so each note lives next to the API/CLI surface it documents; cross-cutting workflows (account migrations spanning many services) live under [[aws/migrations/index|migrations]].

## Foundations

- [[aws/cli/index|AWS CLI]]: profiles, credentials, `--query`, `--output`, JMESPath patterns I reach for.

## Services

- [[aws/iam/index|IAM]]: identities, roles, cross-account trust, permission diagnosis.
- [[aws/rds/index|RDS]]: relational databases, snapshots, cross-account moves.
- [[aws/cloudfront/index|CloudFront]]: distributions, alternate domain names, ACM wiring.
- [[aws/amplify/index|Amplify Hosting]]: app, branch, deployment, domain associations.
- [[aws/s3/index|S3]]: buckets, cross-account copies, bucket policies.
- [[aws/kms/index|KMS]]: customer-managed keys, key policies, cross-account grants.
- [[aws/lambda/index|Lambda]]: functions, deployments, region pinning.

## Cross-cutting workflows

- [[aws/migrations/index|Account migrations]]: end-to-end Simplica → we4labs migration playbook covering RDS, IAM, S3, Amplify and CloudFront in a single narrative, with the per-service recipes linked from each step.

## When to read this area

- You're planning a multi-service migration between AWS accounts.
- A specific service is quarantined and you need to evacuate while leaving healthy services in place.
- A second AWS account is taking over an existing workload and you need to keep the same DNS, data, and permissions wiring.
