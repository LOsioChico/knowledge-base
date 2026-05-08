---
title: RDS
aliases: [aws rds, relational database service, amazon rds]
tags: [type/concept, tech/aws, tech/rds]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/rds/cli]]"
  - "[[aws/rds/cross-account-snapshot]]"
  - "[[aws/kms/cli]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/s3/cross-account-migration]]"
  - "[[aws/ec2/snapshot-all-instances]]"
  - "[[aws/ec2/ami-cross-account-copy]]"
  - "[[aws/kms/index]]"
  - "[[aws/vpc/index]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html
---

> Amazon RDS (Relational Database Service) is managed relational databases: AWS owns the host, the OS, the engine binaries, the backups, the patching cadence, and the failover plumbing. You own the schema, the queries, and the parameter group (the bundle of engine configuration like `max_connections`, `shared_buffers`).

This area is a placeholder. Day-to-day commands live in [[aws/rds/cli|RDS CLI cheatsheet]]; the cross-account migration sits at [[aws/rds/cross-account-snapshot|cross-account snapshot]].

## Pending notes

- Multi-AZ vs read replicas: when each is the right durability/scaling answer.
- Snapshots as the migration primitive: cross-Region copy, cross-account share, restore-into-new-shape.
- Encryption-at-rest gotchas: you can't enable encryption on an existing unencrypted instance; the only path is snapshot → copy with a CMK → restore.
- Operational defaults: deletion protection, automated backups, Performance Insights, customer-managed KMS key from day one.

## See also

- [[aws/rds/cli|RDS CLI cheatsheet]]: snapshot lifecycle, restore, instance state.
- [[aws/rds/cross-account-snapshot|Cross-account RDS snapshot]]: encrypted-snapshot dance for moving a database between accounts.
- [Amazon RDS user guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html) (official).
