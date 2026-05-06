---
title: Cross-account AMI copy (EC2)
aliases: [share ami cross-account, copy ami another account, ec2 ami cross-account migration]
tags: [type/recipe, tech/aws, tech/ec2]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/recipes/index]]"
  - "[[aws/recipes/ec2-snapshot-all-instances]]"
  - "[[aws/recipes/cross-account-snapshot]]"
  - "[[aws/kms]]"
  - "[[aws/rds]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/sharingamis-explicit.html
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/CopyingAMIs.html
  - https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-image-attribute.html
  - https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-snapshot-attribute.html
  - https://docs.aws.amazon.com/cli/latest/reference/ec2/copy-image.html
---

> Move an [[aws/recipes/ec2-snapshot-all-instances|EC2 AMI]] from a source AWS account into a destination account so the destination owns an independent copy. The trap: granting launch permission alone lets the destination _boot_ from the AMI but does NOT let it _copy_ the AMI; a separate snapshot share is required for that.

## When to use this

- You took AMI backups in account A (e.g. with [[aws/recipes/ec2-snapshot-all-instances|snapshot every EC2 instance]]) and want them owned by account B for an [[aws/account-migrations|account migration]] or DR archive.
- You want the AMI to survive even if account A is closed or the source AMI is deregistered. After `copy-image` finishes, the destination AMI and its snapshots are fully independent.

If you only need the destination to launch instances (no ownership transfer), stop after the share step and skip the copy.

## The trap: launch ≠ copy permission

Per the [share-AMI considerations](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/sharingamis-explicit.html):

- Sharing the AMI (`modify-image-attribute --launch-permission`) lets the destination account run `RunInstances` directly from the source AMI; AWS handles the snapshot read internally.
- But "If users in another account want to copy a shared AMI, you must grant them read permissions for the storage that backs the AMI." That means each underlying EBS snapshot also needs `modify-snapshot-attribute --create-volume-permission` for the destination account.

Symptom of forgetting the snapshot share: `aws ec2 copy-image` returns `InvalidSnapshot.NotFound` or `AuthFailure` when run from the destination side.

## Recipe

Uses two CLI profiles: `source` (account A, AMI owner) and `dest` (account B, will receive the copy). Replace `DEST_ACCOUNT_ID`, `SOURCE_REGION`, `DEST_REGION` (often the same), `AMI_ID`, and `BACKUP_TAG` (the tag you used at AMI creation, e.g. `manual-20260505-225304`).

### Pre-flight: confirm both profiles

```bash
aws sts get-caller-identity --profile source --output json
aws sts get-caller-identity --profile dest   --output json
```

The `Account` field MUST equal the expected account ID for each. Mixing up the profiles here is the most expensive mistake: sharing an AMI with the wrong account ID is reversible but noisy.

### 1. List the AMIs to share (source side)

```bash
aws ec2 describe-images --profile source --region SOURCE_REGION --owners self \
  --filters "Name=tag:Backup,Values=BACKUP_TAG" \
  --query 'Images[].{AMI:ImageId,Name:Name,Snap:BlockDeviceMappings[0].Ebs.SnapshotId,Enc:BlockDeviceMappings[0].Ebs.Encrypted}' \
  --output table
```

Capture the `AMI` and `Snap` IDs. The `Enc` column tells you whether the [[aws/kms|KMS]] step in section 4 applies.

### 2. Share the AMI itself (launch permission)

Uses [`aws ec2 modify-image-attribute`](https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-image-attribute.html):

```bash
aws ec2 modify-image-attribute --profile source --region SOURCE_REGION \
  --image-id AMI_ID \
  --launch-permission "Add=[{UserId=DEST_ACCOUNT_ID}]"
```

Verify:

```bash
aws ec2 describe-image-attribute --profile source --region SOURCE_REGION \
  --image-id AMI_ID --attribute launchPermission
```

### 3. Share the underlying EBS snapshot (required for copy)

Uses [`aws ec2 modify-snapshot-attribute`](https://docs.aws.amazon.com/cli/latest/reference/ec2/modify-snapshot-attribute.html), which controls who can create volumes from the snapshot:

```bash
aws ec2 modify-snapshot-attribute --profile source --region SOURCE_REGION \
  --snapshot-id SNAPSHOT_ID \
  --create-volume-permission "Add=[{UserId=DEST_ACCOUNT_ID}]"
```

If the AMI has multiple block-device mappings (data volumes attached), repeat for every snapshot ID.

Verify the destination can see them:

```bash
aws ec2 describe-snapshots --profile dest --region SOURCE_REGION \
  --restorable-by-user-ids self \
  --filters "Name=snapshot-id,Values=SNAPSHOT_ID" \
  --query 'Snapshots[].[SnapshotId,OwnerId,VolumeSize,State]' --output table
```

### 4. (Encrypted volumes only) share the [[aws/kms|KMS]] key

If the source snapshot is encrypted with a customer-managed [[aws/kms|KMS]] key (CMK), grant the destination account `kms:Decrypt`, `kms:DescribeKey`, `kms:CreateGrant` on it via the key policy. Same key-policy edit pattern as [[aws/recipes/cross-account-snapshot|cross-account snapshot sharing]] for [[aws/rds|RDS]] (sections "Grant account B use of the key" and "Grant a re-encrypt key in account-b").

Snapshots encrypted with the default `aws/ebs` AWS-managed key **cannot be shared**: `modify-snapshot-attribute` will fail. The fix is to first re-encrypt under a CMK with [`copy-snapshot --kms-key-id`](https://docs.aws.amazon.com/cli/latest/reference/ec2/copy-snapshot.html), share that copy instead, then proceed.

### 5. Copy the AMI into the destination (destination side)

The copy must be initiated from the **destination** account. AWS rebuilds new snapshots owned by the destination account during the copy. Run [`aws ec2 copy-image`](https://docs.aws.amazon.com/cli/latest/reference/ec2/copy-image.html):

```bash
NEW_AMI=$(aws ec2 copy-image --profile dest --region DEST_REGION \
  --source-region SOURCE_REGION \
  --source-image-id AMI_ID \
  --name "copied-$(date +%Y%m%d)-AMI_ID" \
  --description "Copied from source account on $(date -u +%FT%TZ)" \
  --query ImageId --output text)
echo "New AMI in destination: $NEW_AMI"
```

Same-region copy is the common case (omit `--source-region` and AWS infers it from the source AMI ID's region match against `--region`); cross-region works the same way with both flags.

### 6. Wait for the copy to reach `available`

```bash
aws ec2 wait image-available --profile dest --region DEST_REGION --image-ids $NEW_AMI
aws ec2 describe-images --profile dest --region DEST_REGION --image-ids $NEW_AMI \
  --query 'Images[].[ImageId,Name,State,OwnerId,BlockDeviceMappings[0].Ebs.SnapshotId]' \
  --output table
```

The `OwnerId` should now equal `DEST_ACCOUNT_ID` and the snapshot ID should be a NEW one owned by the destination account, not the original source snapshot.

### 7. Re-tag the copy

[Per the copy considerations](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/CopyingAMIs.html), tags attached by other AWS accounts are NOT carried over. Apply the destination account's own tags after the copy:

```bash
aws ec2 create-tags --profile dest --region DEST_REGION \
  --resources $NEW_AMI \
  --tags Key=SourceAccount,Value=SOURCE_ACCOUNT_ID Key=SourceAMI,Value=AMI_ID Key=Purpose,Value=migration-archive
```

### 8. (Optional) revoke the source-side share

Once the destination has its own copy, the launch+snapshot permissions in the source account are no longer needed:

```bash
aws ec2 modify-image-attribute --profile source --region SOURCE_REGION \
  --image-id AMI_ID --launch-permission "Remove=[{UserId=DEST_ACCOUNT_ID}]"
aws ec2 modify-snapshot-attribute --profile source --region SOURCE_REGION \
  --snapshot-id SNAPSHOT_ID --create-volume-permission "Remove=[{UserId=DEST_ACCOUNT_ID}]"
```

Revoking the share does not affect the destination's already-completed copy.

## Cleanup later

The destination account now owns two storage costs per AMI: the AMI's snapshot blocks. To delete cleanly, use the same deregister + delete-snapshot sequence as in [[aws/recipes/ec2-snapshot-all-instances|snapshot every EC2 instance]]. The source account's original AMI and snapshot are independent and can be deregistered/deleted on their own schedule.

## Cost notes

- The cross-account copy itself is free (best-effort completion); only the destination's new EBS snapshot storage costs money.
- The destination snapshot is a FULL copy of the source data: the destination account's first AMI from a given source pays full snapshot storage, not incremental against the source.
- Time-based copies (15 min to 48 h SLA) cost extra; omit `--completion-duration-minutes` for the free best-effort path.

## Anti-pattern: skipping the copy step

If you only run sections 2-4 (share but don't copy), the destination can launch from the AMI but the AMI still belongs to the source account. If the source account is closed, the source AMI deregistered, or the snapshot share revoked, the destination loses access. For "keep it on the destination forever", the copy is mandatory.
