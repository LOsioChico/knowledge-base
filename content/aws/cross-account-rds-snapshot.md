---
title: Cross-account RDS snapshot sharing
aliases: [share rds snapshot, rds snapshot cmk, cross-account snapshot]
tags: [type/recipe, tech/aws, tech/rds]
area: aws
status: evergreen
source:
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ShareSnapshot.html
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ShareSnapshot.html#USER_ShareSnapshot.Encrypted
  - https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-modifying-external-accounts.html
related:
  - "[[aws/index]]"
  - "[[aws/cross-account-iam-role-pattern]]"
---

> Move an encrypted RDS database between AWS accounts by sharing a snapshot: the trap is that the default service KMS key cannot be shared, so a re-encrypt copy step is required first.

Move an encrypted RDS database from account A to account B by sharing a snapshot. The naive "share snapshot" workflow fails when the snapshot is encrypted with the default AWS-managed KMS key: that key cannot be shared cross-account.

## The trap

You take a snapshot of an encrypted RDS instance, click "Share snapshot", paste account B's ID, and get:

```text
Snapshots encrypted with the default service KMS key cannot be shared.
```

Per the [RDS docs on sharing encrypted snapshots](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/share-encrypted-snapshot.html), the snapshot must be encrypted with a **customer-managed KMS key** (CMK) before it can be shared, and account B must be granted permission to use that key.

## Recipe

Uses two named CLI profiles, `account-a` (source) and `account-b` (target). Replace `ACCOUNT_A_ID` / `ACCOUNT_B_ID` / `REGION` / identifiers as needed.

### In account A (source)

1. **Create a customer-managed KMS key** ([`aws kms create-key`](https://docs.aws.amazon.com/cli/latest/reference/kms/create-key.html)) in the same region as the snapshot:

   ```bash
   KEY_ID=$(aws kms create-key \
     --profile account-a --region REGION \
     --description "CMK for cross-account RDS snapshot share to ACCOUNT_B_ID" \
     --query KeyMetadata.KeyId --output text)
   echo "$KEY_ID"
   ```

2. **Grant account B use of the key** in the key policy ([`aws kms put-key-policy`](https://docs.aws.amazon.com/cli/latest/reference/kms/put-key-policy.html)). Save the policy to `cmk-policy.json` first:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "EnableRootPermissions",
         "Effect": "Allow",
         "Principal": { "AWS": "arn:aws:iam::ACCOUNT_A_ID:root" },
         "Action": "kms:*",
         "Resource": "*"
       },
       {
         "Sid": "AllowAccountBToUseTheKey",
         "Effect": "Allow",
         "Principal": { "AWS": "arn:aws:iam::ACCOUNT_B_ID:root" },
         "Action": ["kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey", "kms:CreateGrant"],
         "Resource": "*"
       }
     ]
   }
   ```

   ```bash
   aws kms put-key-policy \
     --profile account-a --region REGION \
     --key-id "$KEY_ID" \
     --policy-name default \
     --policy file://cmk-policy.json
   ```

   See [Modifying KMS key policies for external accounts](https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-modifying-external-accounts.html). Cross-account KMS access requires **both** the owning-account key policy above **and** an IAM policy in account B that grants the same actions to whichever principal will copy the snapshot (KMS docs: "Neither the key policy nor the IAM policy alone is sufficient: you must change both").

3. **Take a fresh snapshot** ([`aws rds create-db-snapshot`](https://docs.aws.amazon.com/cli/latest/reference/rds/create-db-snapshot.html)):

   ```bash
   aws rds create-db-snapshot \
     --profile account-a --region REGION \
     --db-instance-identifier source-db \
     --db-snapshot-identifier source-db-snap-$(date +%Y%m%d)

   aws rds wait db-snapshot-available \
     --profile account-a --region REGION \
     --db-snapshot-identifier source-db-snap-$(date +%Y%m%d)
   ```

4. **Re-encrypt by copying** with the CMK as the target key ([`aws rds copy-db-snapshot`](https://docs.aws.amazon.com/cli/latest/reference/rds/copy-db-snapshot.html)). The `--kms-key-id` flag is what makes this step necessary in the first place: copying is the only way to change a snapshot's KMS key.

   ```bash
   aws rds copy-db-snapshot \
     --profile account-a --region REGION \
     --source-db-snapshot-identifier source-db-snap-$(date +%Y%m%d) \
     --target-db-snapshot-identifier source-db-snap-cmk \
     --kms-key-id "$KEY_ID"

   aws rds wait db-snapshot-available \
     --profile account-a --region REGION \
     --db-snapshot-identifier source-db-snap-cmk
   ```

5. **Share the re-encrypted snapshot with account B** ([`aws rds modify-db-snapshot-attribute`](https://docs.aws.amazon.com/cli/latest/reference/rds/modify-db-snapshot-attribute.html)). Account ID, not ARN; do NOT use `all`:

   ```bash
   aws rds modify-db-snapshot-attribute \
     --profile account-a --region REGION \
     --db-snapshot-identifier source-db-snap-cmk \
     --attribute-name restore \
     --values-to-add ACCOUNT_B_ID
   ```

### In account B (target)

6. **Confirm the share is visible**:

   ```bash
   aws rds describe-db-snapshots \
     --profile account-b --region REGION \
     --include-shared --snapshot-type shared \
     --query 'DBSnapshots[?DBSnapshotIdentifier==`source-db-snap-cmk`].DBSnapshotArn'
   ```

7. **Copy the shared snapshot into account B**, re-encrypting with a key owned by account B. You can't restore directly from a snapshot that is both shared and encrypted; you must copy it in account B first ([Sharing a DB snapshot for Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ShareSnapshot.html#USER_ShareSnapshot)). The source identifier here is the **ARN** from step 6:

   ```bash
   aws rds copy-db-snapshot \
     --profile account-b --region REGION \
     --source-db-snapshot-identifier arn:aws:rds:REGION:ACCOUNT_A_ID:snapshot:source-db-snap-cmk \
     --target-db-snapshot-identifier source-db-snap-local \
     --kms-key-id alias/aws/rds   # or a CMK owned by account B

   aws rds wait db-snapshot-available \
     --profile account-b --region REGION \
     --db-snapshot-identifier source-db-snap-local
   ```

8. **Restore the DB instance** ([`aws rds restore-db-instance-from-db-snapshot`](https://docs.aws.amazon.com/cli/latest/reference/rds/restore-db-instance-from-db-snapshot.html)):

   ```bash
   aws rds restore-db-instance-from-db-snapshot \
     --profile account-b --region REGION \
     --db-instance-identifier target-db \
     --db-snapshot-identifier source-db-snap-local \
     --db-subnet-group-name target-db-subnet-group \
     --vpc-security-group-ids sg-XXXXXXXX
   ```

9. Sanity-check row counts against the source before cutting traffic over.

## Why a copy step is needed

You can't change the encryption key of an existing snapshot. The copy operation is what allows you to specify a different KMS key. Skipping the copy and trying to share the original (default-key-encrypted) snapshot is the most common failure path.

## Cost and timing

- Snapshot copy time scales with database size; budget for a slow first migration.
- The CMK costs [$1/month per key, prorated hourly](https://aws.amazon.com/kms/pricing/) while it exists. There is no charge for keys scheduled for deletion. Delete (or schedule deletion) once both accounts have what they need.
- [Cross-region snapshot copies incur RDS data transfer charges](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CopySnapshot.html); same-region copies do not.

## Cleanup

After successful restore and row-count checks in account B:

```bash
# Revoke the share
aws rds modify-db-snapshot-attribute \
  --profile account-a --region REGION \
  --db-snapshot-identifier source-db-snap-cmk \
  --attribute-name restore \
  --values-to-remove ACCOUNT_B_ID

# Delete the re-encrypted snapshot once account B has its own copy
aws rds delete-db-snapshot \
  --profile account-a --region REGION \
  --db-snapshot-identifier source-db-snap-cmk

# Schedule the CMK for deletion (7-30 day window) to stop the $1/month charge
aws kms schedule-key-deletion \
  --profile account-a --region REGION \
  --key-id "$KEY_ID" \
  --pending-window-in-days 7
```

- Keep the original source snapshot (`source-db-snap-$(date +%Y%m%d)`) for a rollback window: do not delete the source DB until you are confident in the cutover.
