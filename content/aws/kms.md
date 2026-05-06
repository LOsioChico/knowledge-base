---
title: KMS
aliases: [aws kms, key management service]
tags: [type/concept, tech/aws, tech/kms]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/cli/kms-cheatsheet]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/cli/rds-cheatsheet]]"
  - "[[aws/iam]]"
  - "[[aws/rds]]"
  - "[[aws/secrets-manager]]"
  - "[[aws/recipes/cross-account-snapshot]]"
  - "[[aws/recipes/ec2-snapshot-all-instances]]"
  - "[[aws/recipes/ec2-ami-cross-account-copy]]"
  - "[[aws/recipes/cross-account-bucket-migration]]"
  - "[[aws/account-migrations]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
unrelated:
  - "[[aws/s3]]"
source:
  - https://docs.aws.amazon.com/kms/latest/developerguide/overview.html
  - https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-modifying-external-accounts.html
---

> AWS Key Management Service (KMS) is the encryption-key broker used by every other AWS service that does encryption-at-rest: you create a key once, attach a policy that says who can use it, and then services like S3, [[aws/rds|RDS]], EBS (Elastic Block Store), and [[aws/secrets-manager|Secrets Manager]] call KMS on your behalf to encrypt + decrypt data keys.

## Mental model

A **KMS key** (formerly "CMK", customer master key) is a logical container for cryptographic material that never leaves AWS-managed HSMs (hardware security modules) unencrypted. You don't get the raw key bytes; you ask KMS to encrypt or decrypt small payloads (≤4 KB) on your behalf, or to generate a **data key** that you use locally for envelope encryption.

Three flavors of key, all addressed the same way:

| Key kind                                | Who creates it                                                | Who controls the policy                      | Cross-account use?                              |
| --------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| **Customer-managed**                    | You                                                           | You (full control of key policy)             | Yes                                             |
| **AWS-managed** (`alias/aws/<service>`) | AWS, on demand when a service first needs one in your account | AWS (you can read the policy, can't edit it) | **No**: the policy is locked. This is the trap. |
| **AWS-owned**                           | AWS (shared across many customers)                            | AWS                                          | No (and invisible to you)                       |

The difference matters most for snapshots and shared encrypted resources: an AWS-managed key cannot be shared with another account, so anything encrypted with one is locked into the owning account until you re-encrypt under a customer-managed key.

## Key policies are different

Most AWS services treat [[aws/iam|IAM]] as the access-control layer. KMS does not. A KMS **key policy** is the resource-based policy on the key itself, and it is **the primary authority**: even an IAM admin in your account cannot use a key unless the key policy allows it (directly or via the canonical "delegate to IAM" statement that includes `Principal: {AWS: "arn:aws:iam::ACCOUNT:root"}` plus the `kms:*` action). When in doubt, the key policy is what you read first.

## Cross-account use needs both sides to agree

For account B to use a CMK owned by account A ([source](https://docs.aws.amazon.com/kms/latest/developerguide/key-policy-modifying-external-accounts.html)):

1. **Account A's key policy** has a statement allowing the relevant actions (`kms:Decrypt`, `kms:GenerateDataKey`, `kms:CreateGrant`, etc.) for `Principal: { AWS: "arn:aws:iam::ACCOUNT_B:root" }`. The `:root` form delegates to account B's own IAM, so you don't have to enumerate account-B principals here.
2. **Account B's IAM principal** (the user or role doing the actual call) has an IAM policy granting the same actions on the specific key ARN.
3. **Both** are required. Granting only the key policy fails with `AccessDenied` on the consumer side; granting only the IAM policy fails with `KMSAccessDeniedException` on the KMS side. The error messages are nearly identical, which is why this is a recurring footgun.

The end-to-end shape of this pattern shows up most often in the [[aws/recipes/cross-account-snapshot|RDS cross-account snapshot recipe]]; the same key-policy + IAM-policy pairing applies to S3 with SSE-KMS (server-side encryption using a KMS-managed key, see [[aws/recipes/cross-account-bucket-migration|cross-account bucket migration]]), Secrets Manager, and any other KMS consumer.

> [!warning] Default-key encryption locks you in
> Every "encryption: enabled" toggle that doesn't ask you to pick a key (RDS instance, EBS volume, S3 bucket default encryption) silently uses the AWS-managed key for that service. You can't share, re-key, or migrate the result cross-account. For any resource you might ever move, create a customer-managed key first and pick it explicitly at create time. Switching to a CMK afterwards requires copy + restore.

## Aliases

Key IDs are unmemorable UUIDs. **Aliases** are short, friendly names you assign and can re-point at a different key without consumers noticing: every API call accepts either the key ID, the key ARN, or the alias (`alias/<name>`). Treat aliases as the stable name; treat key IDs as implementation detail.

## See also

- [[aws/cli/kms-cheatsheet|KMS CLI cheatsheet]]: create, alias, key-policy, schedule-deletion.
- [[aws/recipes/cross-account-snapshot|Cross-account RDS snapshot]]: the canonical KMS cross-account recipe.
- [[aws/recipes/cross-account-bucket-migration|Cross-account bucket migration]]: same pattern applied to S3 SSE-KMS.
- [AWS KMS developer guide](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) (official).
