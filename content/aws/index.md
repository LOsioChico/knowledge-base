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
  - "[[aws/iam]]"
  - "[[aws/rds]]"
  - "[[aws/cloudfront]]"
  - "[[aws/amplify]]"
  - "[[aws/s3]]"
  - "[[aws/kms]]"
  - "[[aws/lambda]]"
  - "[[aws/account-migrations]]"
---

> Map of content for AWS. Each service has a concept note at `aws/<service>.md` ("what is it, how does it work, when to use it"); the matching CLI cheatsheet lives at [[aws/cli/index|aws/cli/<service>.md]]; cross-cutting recipes that touch more than one service or don't fit cleanly inside one live under [[aws/recipes/index|aws/recipes]].

## Foundations

- [[aws/cli/index|AWS CLI]]: profiles, credentials, `--query`, `--output`, JMESPath patterns (the JSON query language behind `--query`). Per-service cheatsheets live alongside (e.g. [[aws/cli/s3|S3 CLI cheatsheet]]).

## Services

- [[aws/s3|S3, the Simple Storage Service]]: object storage. Buckets, keys, read-after-write consistency, default privacy.
- [[aws/iam|IAM]]: identities, roles, policy evaluation, cross-account trust.
- [[aws/rds|RDS]] (Relational Database Service): managed relational databases. Snapshots, encryption, multi-AZ (replication across two Availability Zones for failover).
- [[aws/cloudfront|CloudFront]]: content delivery network (CDN). Distributions, alternate domain names, edge (point-of-presence) defaults.
- [[aws/amplify|Amplify Hosting]]: managed frontend hosting. Apps, branches, deployments, custom domains.
- [[aws/kms|KMS]]: encryption keys. Customer-managed vs AWS-managed, key policies, cross-account grants.
- [[aws/lambda|Lambda]]: functions, versions, aliases. (Seed.)

## Recipes

- [[aws/recipes/index|AWS recipes]]: end-to-end procedures that touch more than one service or don't fit cleanly inside a single service note.
  - [[aws/recipes/cross-account-bucket-migration|Cross-account S3 bucket migration]]
  - [[aws/recipes/cross-account-role-pattern|Cross-account IAM role pattern]]
  - [[aws/recipes/cross-account-snapshot|Cross-account RDS snapshot]]
  - [[aws/recipes/alternate-domain-claim|Alternate-domain ghost claims]]
  - [[aws/recipes/cross-account-app-migration|Cross-account Amplify app migration]]
  - [[aws/recipes/ec2-snapshot-all-instances|EC2 in-account AMI snapshot of every instance]]
  - [[aws/recipes/ec2-ami-cross-account-copy|EC2 cross-account AMI copy]]

## Cross-cutting workflows

- [[aws/account-migrations|Account migrations]]: end-to-end migration playbook that stitches the per-service recipes (RDS, IAM, S3, Amplify, CloudFront, KMS) into a single ordered narrative.

## When to read this area

- You're planning a multi-service migration between AWS accounts.
- A specific service is quarantined and you need to evacuate while leaving healthy services in place.
- A second AWS account is taking over an existing workload and you need to keep the same DNS, data, and permissions wiring.
