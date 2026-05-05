---
title: AWS
aliases: [aws notes, amazon web services]
tags: [type/moc, tech/aws]
area: aws
status: evergreen
related:
  - "[[index]]"
  - "[[aws/cross-account-rds-snapshot]]"
  - "[[aws/cloudfront-alternate-domain-claim]]"
  - "[[aws/cross-account-iam-role-pattern]]"
---

Notes on operating AWS, especially the sharp edges that show up when you move workloads between accounts.

## Account migration playbook

When you move a stack from one AWS account to another (compromise, ownership change, billing consolidation), three problem classes account for most of the day-of pain. Each has its own note:

- [[aws/cross-account-rds-snapshot|Cross-account RDS snapshot sharing]]: encrypted snapshots refuse to share with default keys; you must re-encrypt under a customer-managed KMS key first.
- [[aws/cloudfront-alternate-domain-claim|CloudFront alternate-domain ghost claims]]: deleting a distribution doesn't release its CNAME aliases for hours; the bypass is presenting your own ACM certificate.
- [[aws/cross-account-iam-role-pattern|Cross-account IAM assume-role pattern]]: when one service can't move yet, leave it in the old account and let the new account's compute assume a role to use it.

## When to read this area

- You're planning a multi-service migration between AWS accounts.
- A specific service (Lambda, Amplify, etc.) is quarantined and you need to evacuate while leaving healthy services in place.
- A second AWS account is taking over an existing workload and you need to keep the same DNS / domain / data.
