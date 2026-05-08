---
title: S3 CLI cheatsheet
aliases: [aws s3 cli, aws s3api commands]
tags: [type/reference, tech/aws, tech/aws-cli, tech/s3]
area: aws
status: evergreen
related:
  - "[[aws/cli/index]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/cli/query-and-output]]"
  - "[[aws/s3/index]]"
  - "[[aws/s3/quickstart]]"
  - "[[aws/s3/cross-account-migration]]"
source:
---

> Two CLIs for one service: `aws s3` is the high-level "feels like `cp`/`ls`/`sync`" wrapper, `aws s3api` is the thin REST-API mapping. Reach for `s3api` when you need to inspect or set bucket configuration; reach for `s3` when you're moving bytes.

## Inventory

```bash
# All buckets in the current account
aws s3api list-buckets --query 'Buckets[].{Name:Name,Created:CreationDate}' --output table

# Does this bucket exist and is it reachable from this profile?
aws s3api head-bucket --bucket <name>

# Which Region is it pinned to?
aws s3api get-bucket-location --bucket <name>

# Peek at a few keys
aws s3api list-objects-v2 --bucket <name> --max-items 5

# Object count (cheap-ish; for huge buckets use S3 Inventory instead)
aws s3api list-objects-v2 --bucket <name> --query 'KeyCount' --output text
```

## Configuration

These are the per-bucket settings worth replicating verbatim before you trust a "new" bucket:

```bash
aws s3api get-bucket-policy        --bucket <name>
aws s3api get-bucket-encryption    --bucket <name>
aws s3api get-bucket-versioning    --bucket <name>
aws s3api get-public-access-block  --bucket <name>
aws s3api get-bucket-ownership-controls --bucket <name>
aws s3api get-bucket-lifecycle-configuration --bucket <name>
```

## Lifecycle

```bash
# Create
aws s3api create-bucket --bucket <name> --region <region> \
  [--create-bucket-configuration LocationConstraint=<region>]   # required outside us-east-1

# Default to the safe settings
aws s3api put-public-access-block --bucket <name> \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket <name> --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket <name> \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Empty + delete
aws s3 rm s3://<name> --recursive
aws s3api delete-bucket --bucket <name>
```

## Moving bytes

```bash
# List
aws s3 ls s3://<bucket>/<prefix>/

# Copy a single object (server-side, no client bandwidth)
aws s3 cp s3://<src>/<key> s3://<dst>/<key>

# Mirror a whole bucket / prefix (skips objects already at destination with the same size + mtime)
aws s3 sync s3://<src-bucket> s3://<dst-bucket>

# One-way upload from local
aws s3 sync ./build/ s3://<bucket>/static/ --delete
```

For cross-account `s3 sync`, the source bucket policy must grant the target account `s3:GetObject` and `s3:ListBucket`; full walkthrough in [[aws/s3/cross-account-migration|cross-account bucket migration]].

## Tips

- Add `--profile <name>` to every command when juggling accounts; see [[aws/cli/profiles-and-credentials|profiles and credentials]] for setup. Forgetting which profile is active is the #1 way to mutate the wrong bucket.
- Shape output for pipelines with `--query` and `--output text`; see [[aws/cli/query-and-output|query and output]].
- `aws s3 cp` and `aws s3 sync` perform server-side copies between buckets when both are S3 URIs, so client bandwidth is not the bottleneck. For very large transfers, run the command from EC2 in the destination Region.
