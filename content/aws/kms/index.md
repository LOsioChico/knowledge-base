---
title: KMS
aliases: [aws kms, key management service]
tags: [type/moc, tech/aws, tech/kms]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/rds/cross-account-snapshot]]"
  - "[[aws/s3/cross-account-bucket-migration]]"
---

Notes on AWS Key Management Service: customer-managed keys (CMKs), key policies, aliases, and the cross-account grants you need when one account encrypts and another decrypts.

The most common cross-account KMS pattern is captured in [[aws/rds/cross-account-snapshot|the RDS snapshot recipe]]; the same key-policy edit pattern (root in owning account, action allow for external account, plus an IAM policy on the calling principal in the consumer account) applies to S3, Secrets Manager, and any other KMS consumer.

## CLI cheat-sheet

```bash
# Create + label
aws kms create-key            --description "<purpose>" --query KeyMetadata.KeyId --output text
aws kms create-alias          --alias-name alias/<name> --target-key-id <KEY_ID>
aws kms list-aliases          --key-id <KEY_ID> --query 'Aliases[].AliasName' --output json

# Inspect
aws kms describe-key          --key-id <KEY_ID> \
  --query 'KeyMetadata.{Arn:Arn,KeyManager:KeyManager,KeyState:KeyState,Description:Description}' \
  --output json

# Cross-account grant (modify the JSON policy, then put-key-policy)
aws kms put-key-policy        --key-id <KEY_ID> --policy-name default --policy file://cmk-policy.json

# Cleanup
aws kms schedule-key-deletion --key-id <KEY_ID> --pending-window-in-days 7
```

## Cross-account checklist

When account B needs to use a CMK owned by account A:

1. Account A's key policy includes a statement that allows the relevant `kms:Decrypt` / `kms:GenerateDataKey` / `kms:CreateGrant` actions for `Principal: { AWS: "arn:aws:iam::ACCOUNT_B:root" }`.
2. Account B's IAM principal (user or role) has an IAM policy granting the same actions on the specific key ARN. Per [the KMS docs](https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-modifying-external-accounts.html), neither alone is enough: both are required.
3. The consumer-side principal explicitly references the key (by ARN or by alias when the consumer service supports it).
