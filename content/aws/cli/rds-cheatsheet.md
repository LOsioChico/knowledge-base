---
title: RDS CLI cheatsheet
aliases: [aws rds cli, rds snapshot commands]
tags: [type/reference, tech/aws, tech/aws-cli, tech/rds]
area: aws
status: evergreen
related:
  - "[[aws/cli/index]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/rds]]"
  - "[[aws/kms]]"
  - "[[aws/recipes/cross-account-snapshot]]"
---

> Read + snapshot + restore commands for [[aws/rds|RDS]]. The snapshot family is the entire surface area for migrations and backup audits; the rest is just inventory.

## Inventory + state

```bash
aws rds describe-db-instances        --db-instance-identifier <id>
aws rds describe-db-snapshots        --db-snapshot-identifier <id>
aws rds describe-db-snapshot-attributes --db-snapshot-identifier <id>

# Filtered listing
aws rds describe-db-instances \
  --query 'DBInstances[].{Id:DBInstanceIdentifier,Status:DBInstanceStatus,Engine:Engine,Class:DBInstanceClass,MultiAZ:MultiAZ}' \
  --output table
```

## Snapshot lifecycle

```bash
# Take a manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier <id> \
  --db-snapshot-identifier <name>

# Copy (re-encrypt under a different KMS key, or move Region)
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier <src-arn-or-id> \
  --target-db-snapshot-identifier <dst-name> \
  [--kms-key-id <key>] [--source-region <region>]

# Share with another account (unencrypted, or encrypted with a CMK only)
aws rds modify-db-snapshot-attribute \
  --db-snapshot-identifier <name> \
  --attribute-name restore \
  --values-to-add <ACCOUNT_ID>

# Cleanup
aws rds delete-db-snapshot --db-snapshot-identifier <name>
```

## Restore

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier <new-id> \
  --db-snapshot-identifier <snap> \
  [--db-instance-class db.t4g.medium] \
  [--db-subnet-group-name <subnet-group>] \
  [--vpc-security-group-ids sg-xxxx]
```

## Wait for state transitions

```bash
aws rds wait db-snapshot-available  --db-snapshot-identifier <name>
aws rds wait db-instance-available  --db-instance-identifier <id>
aws rds wait db-instance-deleted    --db-instance-identifier <id>
```

## Tips

- Snapshot operations are async. Always `wait` between create-snapshot, copy-snapshot, and restore in scripts; otherwise the next call fails with a `InvalidDBSnapshotState` error.
- For cross-account moves, the full sequence (with the [[aws/kms|KMS]] step) is in [[aws/recipes/cross-account-snapshot|cross-account RDS snapshot]].
- Replace `--profile` with the right account on every write command. See [[aws/cli/profiles-and-credentials|profiles and credentials]] for the assume-role-via-config setup.
