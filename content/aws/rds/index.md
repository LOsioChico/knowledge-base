---
title: RDS
aliases: [aws rds, relational database service]
tags: [type/moc, tech/aws, tech/rds]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/rds/cross-account-snapshot]]"
  - "[[aws/kms/index]]"
---

Notes on Amazon RDS: snapshots, cross-account moves, and the commands I keep going back to during a migration.

## Notes

- [[aws/rds/cross-account-snapshot|Cross-account RDS snapshot sharing]]: encrypted snapshots refuse to share with default keys; you must re-encrypt under a customer-managed KMS key first.

## CLI cheat-sheet

```bash
# Inventory + state
aws rds describe-db-instances        --db-instance-identifier <id>
aws rds describe-db-snapshots        --db-snapshot-identifier <id>
aws rds describe-db-snapshot-attributes --db-snapshot-identifier <id>

# Snapshot lifecycle
aws rds create-db-snapshot           --db-instance-identifier <id> --db-snapshot-identifier <name>
aws rds copy-db-snapshot             --source-db-snapshot-identifier <src> --target-db-snapshot-identifier <dst> [--kms-key-id <key>]
aws rds modify-db-snapshot-attribute --db-snapshot-identifier <name> --attribute-name restore --values-to-add <ACCOUNT_ID>
aws rds delete-db-snapshot           --db-snapshot-identifier <name>

# Restore
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier <new-id> --db-snapshot-identifier <snap>

# Wait for state transitions
aws rds wait db-snapshot-available  --db-snapshot-identifier <name>
aws rds wait db-instance-available  --db-instance-identifier <id>
```
