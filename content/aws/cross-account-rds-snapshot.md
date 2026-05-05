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

In **account A** (the source):

1. Create a customer-managed KMS key (or reuse one) in the same region as the snapshot.
2. Add account B as a key user in the key policy:

   ```json
   {
     "Sid": "AllowAccountBToUseTheKey",
     "Effect": "Allow",
     "Principal": { "AWS": "arn:aws:iam::ACCOUNT_B_ID:root" },
     "Action": ["kms:Decrypt", "kms:DescribeKey", "kms:GenerateDataKey", "kms:CreateGrant"],
     "Resource": "*"
   }
   ```

   See [Modifying KMS key policies for external accounts](https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-modifying-external-accounts.html). Cross-account KMS access requires **both** the owning-account key policy above **and** an IAM policy in account B that grants the same actions to whichever principal will copy the snapshot (KMS docs: "Neither the key policy nor the IAM policy alone is sufficient: you must change both").

3. Take a fresh snapshot of the source DB.
4. **Copy** that snapshot to a new snapshot encrypted with the CMK from step 1 (`Copy snapshot` action; pick the CMK as the encryption key).
5. Share the copied snapshot with account B (account ID, not ARN).

In **account B** (the target):

6. Find the shared snapshot under "Snapshots → Shared with me".
7. **Copy** the shared snapshot into account B (`Copy snapshot`; choose a target KMS key owned by account B). You can't restore directly from a snapshot that is both shared and encrypted; you must copy it in account B first ([Sharing a DB snapshot for Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ShareSnapshot.html#USER_ShareSnapshot)).
8. **Restore** a DB instance from the step 7 copy.
9. Sanity-check row counts against the source before cutting traffic over.

## Why a copy step is needed

You can't change the encryption key of an existing snapshot. The copy operation is what allows you to specify a different KMS key. Skipping the copy and trying to share the original (default-key-encrypted) snapshot is the most common failure path.

## Cost and timing

- Snapshot copy time scales with database size; budget for a slow first migration.
- The CMK costs [$1/month per key, prorated hourly](https://aws.amazon.com/kms/pricing/) while it exists. There is no charge for keys scheduled for deletion. Delete (or schedule deletion) once both accounts have what they need.
- [Cross-region snapshot copies incur RDS data transfer charges](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CopySnapshot.html); same-region copies do not.

## Cleanup

After successful restore and row-count checks in account B:

- Revoke the snapshot share in account A (or delete the shared snapshot copy).
- Optionally remove account B from the CMK policy.
- Keep the original source snapshot for a rollback window: do not delete the source DB until you are confident in the cutover.
