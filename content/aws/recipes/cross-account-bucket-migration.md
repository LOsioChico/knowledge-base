---
title: Cross-account S3 bucket migration
aliases: [s3 cross-account copy, s3 sync cross-account, migrate s3 bucket]
tags: [type/recipe, tech/aws, tech/s3, tech/iam]
area: aws
status: evergreen
source:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html
related:
  - "[[aws/s3]]"
  - "[[aws/cli/s3]]"
  - "[[aws/recipes/index]]"
  - "[[aws/iam/cross-account-role-pattern]]"
  - "[[aws/rds/cross-account-snapshot]]"
  - "[[aws/migrations/index]]"
---

> Move an S3 bucket between AWS accounts by inspecting the source bucket's configuration, recreating it in the target account, granting cross-account read on the source, and using `aws s3 sync` (server-side copies) to replicate the contents.

## Trade-off vs. cross-account replication

[S3 Cross-Region or Cross-Account Replication](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html) is the right tool when you need ongoing replication. For a one-shot migration where you just need the data in the new account before you cut writers over, `aws s3 sync` is simpler: no replication-config, no IAM-role-on-the-bucket, no waiting for new objects to replicate. The trade-off is no incremental change-tracking: you re-run `sync` to catch up, which is fine for a planned cutover window.

## Recipe

Uses two named CLI profiles, `account-a` (source) and `account-b` (target). Replace `<SRC_BUCKET>`, `<DST_BUCKET>`, `ACCOUNT_B_ID` as needed.

### Pre-flight

```bash
aws sts get-caller-identity --profile account-a --output json
aws sts get-caller-identity --profile account-b --output json
```

### 1. Inventory the source bucket

You'll need to recreate every one of these settings on the new bucket: defaults are not always what you want.

```bash
aws s3api head-bucket            --profile account-a --bucket <SRC_BUCKET>
aws s3api get-bucket-location    --profile account-a --bucket <SRC_BUCKET>
aws s3api get-bucket-policy      --profile account-a --bucket <SRC_BUCKET> --query Policy --output text > src-bucket-policy.json
aws s3api get-bucket-encryption  --profile account-a --bucket <SRC_BUCKET> > src-bucket-encryption.json
aws s3api get-bucket-versioning  --profile account-a --bucket <SRC_BUCKET>
aws s3api get-public-access-block --profile account-a --bucket <SRC_BUCKET>
aws s3api list-objects-v2        --profile account-a --bucket <SRC_BUCKET> --query 'KeyCount' --output text
```

The last command's count is the figure to match after `sync`.

### 2. Create the destination bucket in account B

```bash
aws s3api create-bucket \
  --profile account-b --region us-east-1 \
  --bucket <DST_BUCKET>
# For regions other than us-east-1, add:
#   --create-bucket-configuration LocationConstraint=<REGION>
```

Apply the same defensive defaults the source used. At minimum, block public access unless you genuinely need it:

```bash
aws s3api put-public-access-block \
  --profile account-b --bucket <DST_BUCKET> \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-versioning \
  --profile account-b --bucket <DST_BUCKET> \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --profile account-b --bucket <DST_BUCKET> \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

If the source used SSE-KMS with a CMK, replicate the CMK in account B (or share the source CMK to account B, same pattern as [[aws/rds/cross-account-snapshot|RDS cross-account snapshots]]).

### 3. Grant account B read on the source bucket

`aws s3 sync` from `s3://src` to `s3://dst` runs as account B's principal but reads from account A's bucket. The source bucket policy must allow it. Save as `src-bucket-grant.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAccountBToReadForMigration",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::ACCOUNT_B_ID:root" },
      "Action": ["s3:GetObject", "s3:GetObjectVersion", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::<SRC_BUCKET>", "arn:aws:s3:::<SRC_BUCKET>/*"]
    }
  ]
}
```

```bash
# Merge with the existing policy, do not overwrite. If you'll later need to revert,
# back up src-bucket-policy.json first (you already have it from step 1).
aws s3api put-bucket-policy \
  --profile account-a --bucket <SRC_BUCKET> \
  --policy file://src-bucket-grant.json
```

If the source bucket is SSE-KMS-encrypted, also grant account B `kms:Decrypt` on the source CMK (same key-policy edit as the [[aws/rds/cross-account-snapshot|RDS recipe]] step 2).

### 4. Sync the data

```bash
aws s3 sync \
  --profile account-b \
  s3://<SRC_BUCKET> \
  s3://<DST_BUCKET>
```

`aws s3 sync` performs server-side copies for objects not present at the destination (or with a different size/mtime), and skips matching objects. For very large buckets, run it from EC2 in the destination region to avoid client-side bandwidth being the bottleneck. Re-run the same command at cutover to catch up any objects written since the first run.

### 5. Verify

```bash
# Object counts should match
aws s3api list-objects-v2 --profile account-a --bucket <SRC_BUCKET> --query 'KeyCount' --output text
aws s3api list-objects-v2 --profile account-b --bucket <DST_BUCKET> --query 'KeyCount' --output text

# Spot-check sizes for a sample key
aws s3api head-object --profile account-a --bucket <SRC_BUCKET> --key <some/key>
aws s3api head-object --profile account-b --bucket <DST_BUCKET> --key <some/key>
```

For high-stakes data, run `aws s3 ls --recursive --summarize` on both sides and diff the totals.

### 6. Cut writers over

Update application configuration to write to `<DST_BUCKET>` from account B. Run `aws s3 sync` once more to capture any objects written between the previous sync and the cutover. Keep the source bucket read-only-for-rollback for at least a few days before deleting.

## Cleanup

```bash
# Revert the cross-account read grant once cutover is complete
aws s3api put-bucket-policy \
  --profile account-a --bucket <SRC_BUCKET> \
  --policy file://src-bucket-policy.json   # the backup from step 1

# (Eventually) delete the source bucket. Empty it first.
aws s3 rm s3://<SRC_BUCKET> --recursive --profile account-a
aws s3api delete-bucket --profile account-a --bucket <SRC_BUCKET>
```

## What NOT to skip

- **Recreating the bucket policy in the target.** A "works in dev" bucket with no policy will surprise you in prod; copy the source policy verbatim, then audit it.
- **Versioning.** If the source had versioning, enable it on the target BEFORE `sync`. Enabling after means object versions written between bucket creation and versioning-on are unversioned forever.
- **Public-access block.** This is account-level AND bucket-level. Replicate both unless you have an explicit reason not to.
