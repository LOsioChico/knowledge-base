---
title: S3
aliases: [aws s3, simple storage service]
tags: [type/moc, tech/aws, tech/s3]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/s3/cross-account-bucket-migration]]"
---

Notes on Amazon S3: buckets, cross-account copies, encryption + policy inspection.

## Notes

- [[aws/s3/cross-account-bucket-migration|Cross-account S3 bucket migration]]: replicate bucket configuration (policy, encryption, versioning, public-access block) and `aws s3 sync` the contents into a new account.

## CLI cheat-sheet

```bash
# Inventory
aws s3api list-buckets --query 'Buckets[].{Name:Name,Created:CreationDate}' --output table
aws s3api head-bucket --bucket <name>                           # exists + reachable from this profile
aws s3api get-bucket-location --bucket <name>                   # which region
aws s3api list-objects-v2 --bucket <name> --max-items 5

# Configuration (the things you must replicate when migrating)
aws s3api get-bucket-policy        --bucket <name>
aws s3api get-bucket-encryption    --bucket <name>
aws s3api get-bucket-versioning    --bucket <name>
aws s3api get-public-access-block  --bucket <name>

# Lifecycle
aws s3api create-bucket --bucket <name> --region <region> \
  [--create-bucket-configuration LocationConstraint=<region>]   # required outside us-east-1

# Bulk copy
aws s3 ls   s3://<bucket>/<prefix>/
aws s3 sync s3://<src-bucket> s3://<dst-bucket>
```
