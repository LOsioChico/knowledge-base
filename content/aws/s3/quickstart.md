---
title: S3 quickstart
aliases: [s3 first bucket, s3 hello world, aws s3 walkthrough]
tags: [type/recipe, tech/aws, tech/s3, tech/aws-cli]
area: aws
status: evergreen
related:
  - "[[aws/s3/index]]"
  - "[[aws/s3/cli]]"
  - "[[aws/s3/presigned-urls]]"
  - "[[aws/s3/lifecycle-rules]]"
  - "[[aws/s3/static-website]]"
  - "[[aws/s3/storage-classes]]"
  - "[[aws/s3/event-notifications]]"
  - "[[aws/lambda/index]]"
  - "[[aws/iam/index]]"
  - "[[aws/cli/profiles-and-credentials]]"
source:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html
---

> First-bucket walkthrough: create a bucket with safe defaults, upload an object, share it with a presigned URL, and clean everything up. The 10-minute path from "I have AWS credentials" to "S3 is doing something for me", with no console clicks.

## Before you start

You need:

- An AWS CLI profile that resolves to an account you can write to. Set up via [[aws/cli/profiles-and-credentials|profiles and credentials]]. Verify with:

  ```bash
  aws --profile <name> sts get-caller-identity
  # {
  #   "UserId": "...",
  #   "Account": "123456789012",
  #   "Arn": "arn:aws:iam::123456789012:user/you"
  # }
  ```

- A Region you want the bucket to live in (`us-east-1`, `eu-west-1`, etc.). The bucket is pinned to it forever; pick the Region closest to whoever reads the data most.

Two shell variables used in every command below:

```bash
export AWS_PROFILE=<your-profile>
export REGION=us-east-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export BUCKET=quickstart-${ACCOUNT_ID}-${REGION}
```

The `<purpose>-<account>-<region>` shape sidesteps the global-namespace fight: nobody else has your account ID. (For the production-grade variant where AWS itself reserves the name, see the account-regional namespace section in [[aws/s3/index|S3]].)

## 1. Create the bucket

```bash
# us-east-1 is the only Region that does NOT take --create-bucket-configuration
if [ "$REGION" = "us-east-1" ]; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
else
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
fi
```

Then layer on the three settings every new bucket should start with:

```bash
# Block all public access at the bucket level (defense-in-depth on top of the account-level toggle)
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Keep every overwrite as a recoverable version
aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

# Server-side encrypt every new object with an AWS-managed key (free)
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

> [!warning]- Versioning without a lifecycle rule grows your bill forever
> Each version is the entire object, not a diff. Three overwrites of a 1 GB file = 3 GB billed. Add a [[aws/s3/lifecycle-rules|lifecycle rule]] that expires noncurrent versions after N days before you put real data in.

## 2. Upload an object

```bash
echo "hello s3" > hello.txt
aws s3 cp hello.txt "s3://$BUCKET/hello.txt"
# upload: ./hello.txt to s3://quickstart-123456789012-us-east-1/hello.txt
```

`aws s3 cp` (the high-level wrapper) is the right tool when you're moving bytes; `aws s3api put-object` is the same operation expressed as the raw REST verb. Use `cp`/`sync` unless you need a flag only the API exposes.

## 3. List and download

```bash
aws s3 ls "s3://$BUCKET/"
# 2026-05-08 14:21:33          9 hello.txt

aws s3 cp "s3://$BUCKET/hello.txt" downloaded.txt
cat downloaded.txt
# hello s3
```

## 4. Share it without making the bucket public

The bucket is private. To let someone else download `hello.txt` for an hour without giving them an [[aws/iam/index|IAM]] identity, sign a [[aws/s3/presigned-urls|presigned URL]]:

```bash
aws s3 presign "s3://$BUCKET/hello.txt" --expires-in 3600
# https://quickstart-123456789012-us-east-1.s3.us-east-1.amazonaws.com/hello.txt?X-Amz-Algorithm=...&X-Amz-Expires=3600&X-Amz-Signature=...
```

Anyone with the link can `curl` it during the next 3600 seconds; after that the signature is rejected.

## 5. Clean up

You pay storage by the GB-month, so leftover quickstart buckets are cheap but not free. Tear it down before moving on:

```bash
# Delete every object AND every noncurrent version (versioning is on, so plain rm leaves history behind)
aws s3api delete-objects --bucket "$BUCKET" \
  --delete "$(aws s3api list-object-versions --bucket "$BUCKET" \
    --query '{Objects: [Versions, DeleteMarkers][].{Key:Key,VersionId:VersionId}}' \
    --output json)"

aws s3api delete-bucket --bucket "$BUCKET" --region "$REGION"
```

> [!warning] `aws s3 rm --recursive` does not remove versions
> On a versioning-enabled bucket it adds a delete marker per object; the bytes stay and `delete-bucket` then fails with `BucketNotEmpty`. Use `delete-objects` with `list-object-versions` (the snippet above) to truly empty a versioned bucket.

## Where to go next

- [[aws/s3/storage-classes|Storage classes]]: pick the right cost/latency tier (Standard, Intelligent-Tiering, IA, Glacier).
- [[aws/s3/lifecycle-rules|Lifecycle rules]]: age objects through cheaper classes and expire noncurrent versions automatically.
- [[aws/s3/event-notifications|Event notifications]]: trigger [[aws/lambda/index|Lambda]] / SQS / SNS when objects are created or deleted.
- [[aws/s3/static-website|Static website hosting]]: serve a bucket as a public site, fronted by [[aws/cloudfront/index|CloudFront]] for HTTPS.
- [[aws/s3/cli|S3 CLI cheatsheet]]: the full command surface once you outgrow this walkthrough.

## See also

- [[aws/s3/index|S3 concept note]]: buckets, objects, consistency, pricing model.
- [Amazon S3 user guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html) (official).
