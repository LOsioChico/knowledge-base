---
title: RDS
aliases: [aws rds, relational database service, amazon rds]
tags: [type/concept, tech/aws, tech/rds]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/rds/cli]]"
  - "[[aws/kms/cli]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/recipes/cross-account-snapshot]]"
  - "[[aws/s3/cross-account-migration]]"
  - "[[aws/recipes/ec2-snapshot-all-instances]]"
  - "[[aws/recipes/ec2-ami-cross-account-copy]]"
  - "[[aws/kms/index]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html
---

> Amazon RDS (Relational Database Service) is managed relational databases: AWS owns the host, the OS, the engine binaries, the backups, the patching cadence, and the failover plumbing. You own the schema, the queries, and the parameter group (the bundle of engine configuration like `max_connections`, `shared_buffers`). Day-to-day commands live in the [[aws/rds/cli|RDS CLI cheatsheet]].

## Mental model

An **RDS instance** is one engine (PostgreSQL, MySQL, MariaDB, Oracle, SQL Server, or Aurora-flavored Postgres/MySQL) running on one EC2-class host that AWS manages for you. You connect to it like any other database: `host:port` + credentials. RDS handles backups, minor-version upgrades, host replacement on hardware failure, and (when configured) cross-AZ failover.

The unit of "I have a database" is the **DB instance**; the unit of "I have a backup" is the **DB snapshot**. Snapshots are crash-consistent (taken without quiescing the engine, equivalent to recovering from a sudden power-off) point-in-time copies of the storage volume, are encrypted with the same [[aws/kms/index|KMS]] key as the source instance, and can be restored as a new DB instance in any combination of Region/account/parameter-group/instance-class.

## What RDS gives you for free

- **Automated backups** (daily snapshot + transaction log shipping) with point-in-time restore inside the configured retention window (1–35 days). Default is 7 days; set it to the regulatory minimum, not the AWS default.
- **Multi-AZ** with a synchronous standby in another Availability Zone for production workloads. Failover is automatic on host loss; ~60–120s of unavailability ([source](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html)). The standby is invisible to your application: same endpoint, same DNS.
- **Read replicas** (async logical replication for engines that support it). Same Region or cross-Region. Replicas can be promoted to standalone primaries for blue/green migrations (run the new version alongside the old, then cut traffic over).
- **Encryption at rest** when you enable it at create time, backed by a KMS key. **You cannot enable encryption on an existing unencrypted instance**; the only path is snapshot → copy with a CMK → restore.

## Snapshots are the migration primitive

Almost every "move this database somewhere" workflow is a snapshot dance:

| Goal                                         | Snapshot move                                                                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Different Region, same account               | `copy-db-snapshot` with `--source-region`.                                                                                                                              |
| Different account, same Region (unencrypted) | `modify-db-snapshot-attribute --attribute-name restore` to add the target account.                                                                                      |
| Different account, encrypted                 | Re-encrypt under a customer-managed KMS key first; the default service key cannot be shared. See [[aws/recipes/cross-account-snapshot\|cross-account snapshot recipe]]. |
| New parameter group / instance class         | Restore from snapshot into the new shape; cut over.                                                                                                                     |
| Major-version upgrade test                   | Restore snapshot into a throwaway instance; run the upgrade against that.                                                                                               |

> [!warning] Default-key encrypted snapshots can't be shared
> If your instance was encrypted with the AWS-managed RDS key (`alias/aws/rds`), the snapshot cannot be shared cross-account no matter what permissions you set. The fix is to copy the snapshot under a customer-managed KMS key first, then share the copy. Full walkthrough: [[aws/recipes/cross-account-snapshot|cross-account RDS snapshot]].

## Operational sanity defaults

For any new RDS instance, the boring-but-correct defaults are:

- Multi-AZ on for anything that touches users.
- Backup retention set to the longest your team will pay for (longer is cheaper than wishing you'd set it longer).
- Deletion protection on (turn off only when you actually mean to delete).
- Encryption on, customer-managed KMS key (gives you the option to migrate later without the re-encrypt step).
- Automatic minor-version upgrades on; pick a maintenance window when traffic is lowest.
- Performance Insights on (the built-in database load + top-SQL dashboard; free tier covers 7 days of metrics, saves you the next debugging session).

## See also

- [[aws/rds/cli|RDS CLI cheatsheet]]: snapshot lifecycle, restore, instance state.
- [[aws/recipes/cross-account-snapshot|Cross-account RDS snapshot]]: the encrypted-snapshot dance for moving a database between accounts.
- [[aws/kms/index|KMS]]: the key policies that gate encrypted-snapshot sharing.
- [Amazon RDS user guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html) (official).
