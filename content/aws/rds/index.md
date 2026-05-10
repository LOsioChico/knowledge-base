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
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateSnapshot.html
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html
---

> Amazon RDS (Relational Database Service) is managed relational databases: AWS owns the host, the OS, the engine binaries, the backups, the patching cadence, and the failover plumbing. You own the schema, the queries, and the parameter group (the bundle of engine configuration like `max_connections`, `shared_buffers`).

## TL;DR

- **DB instance = one engine on one host** (PostgreSQL, MySQL, MariaDB, Oracle, SQL Server, or Aurora-flavored Postgres/MySQL). You connect over `host:port`.
- **DB snapshot = the backup primitive.** Storage-volume copy; encrypted with the same [[aws/kms/index|KMS]] key as the source ([source](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html#Overview.Encryption.Limitations)). Single-AZ creates briefly suspend I/O; Multi-AZ MariaDB/MySQL/Oracle/PostgreSQL avoid the suspension by snapshotting the standby ([source](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateSnapshot.html)). Migrations are snapshot dances.
- **Multi-AZ** is sync standby in another Availability Zone for production failover (~60-120s); **read replicas** are async (and promotable to standalone primaries).
- **Encryption is a create-time decision.** You can't enable it on an existing unencrypted instance: the only path is snapshot → copy under a CMK → restore.
- **Operational defaults to set on day one**: Multi-AZ on for user-facing workloads, deletion protection on, customer-managed KMS key (so you can migrate later), Performance Insights (RDS's per-query performance dashboard) on.

## When to use

- **Use RDS** for: any production relational database where you don't want to babysit the host, backups, or failover.
- **Use Aurora (also under RDS)** when you need the cluster-storage architecture, faster failover, or read replicas with sub-second lag.
- **Don't use RDS** for: throwaway dev databases (run Postgres in a container) or workloads that need filesystem-level access (run on [[aws/ec2/index|EC2]]).

## Mental model

The unit of "I have a database" is the **DB instance**; the unit of "I have a backup" is the **DB snapshot**. Snapshots are storage-volume copies whose I/O behavior depends on deployment shape: Single-AZ instances see a brief I/O suspension (seconds to minutes) during creation; Multi-AZ MariaDB/MySQL/Oracle/PostgreSQL take the snapshot from the standby with no primary-side suspension; Multi-AZ SQL Server still suspends briefly ([source](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateSnapshot.html)). Snapshots are encrypted with the same KMS key as the source instance and can be restored as a new DB instance across Region/account/parameter-group/instance-class (the RDS sizing bucket: family + size, e.g. `db.m6i.large`, picks CPU and memory). Encrypted snapshots have additional constraints: snapshots under the AWS-managed RDS key cannot be shared cross-account; you must copy under a customer-managed key first ([source](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ShareSnapshot.html)). Almost every "move this database somewhere" workflow is a snapshot dance: cross-Region copy, cross-account share, restore-into-new-shape, major-version upgrade test.

## Pending notes

- Multi-AZ vs read replicas: when each is the right durability/scaling answer.
- Snapshots as the migration primitive: cross-Region copy, cross-account share, restore-into-new-shape.
- Encryption-at-rest gotchas: you can't enable encryption on an existing unencrypted instance; the only path is snapshot → copy with a CMK → restore.
- Operational defaults: deletion protection, automated backups, Performance Insights, customer-managed KMS key from day one.

## See also

- [[aws/rds/cli|RDS CLI cheatsheet]]: snapshot lifecycle, restore, instance state.
- [[aws/rds/cross-account-snapshot|Cross-account RDS snapshot]]: encrypted-snapshot dance for moving a database between accounts.
- [Amazon RDS user guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html) (official).
