---
title: KMS
aliases: [aws kms, key management service]
tags: [type/concept, tech/aws, tech/kms]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/kms/cli]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/rds/cli]]"
  - "[[aws/iam/index]]"
  - "[[aws/rds/index]]"
  - "[[aws/secrets-manager]]"
  - "[[aws/rds/cross-account-snapshot]]"
  - "[[aws/ec2/snapshot-all-instances]]"
  - "[[aws/ec2/ami-cross-account-copy]]"
  - "[[aws/s3/cross-account-migration]]"
  - "[[aws/account-migrations]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
unrelated:
  - "[[aws/s3/index]]"
source:
  - https://docs.aws.amazon.com/kms/latest/developerguide/overview.html
---

> AWS Key Management Service (KMS) is the encryption-key broker used by every other AWS service that does encryption-at-rest: you create a key once, attach a policy that says who can use it, and then services like S3, [[aws/rds/index|RDS]], EBS (Elastic Block Store), and [[aws/secrets-manager|Secrets Manager]] call KMS on your behalf to encrypt + decrypt **data keys** (short-lived symmetric keys KMS mints to wrap your actual data, so the long-lived KMS key only ever protects keys, not bulk data).

## TL;DR

- **A KMS key is a logical container** for cryptographic material that never leaves AWS-managed HSMs (hardware security modules) unencrypted. You don't get raw key bytes.
- **Three key flavors**: customer-managed (you own the policy, can share cross-account), AWS-managed (`alias/aws/<service>`, AWS owns the policy, locked to one account), AWS-owned (invisible, shared across customers).
- **Key policies are the primary authority.** Even an [[aws/iam/index|IAM]] admin in your account cannot use a key unless the key policy allows it (directly or via the canonical `Principal: { AWS: "arn:aws:iam::ACCOUNT:root" }` "delegate to IAM" statement).
- **Aliases (`alias/<name>`) are the stable name**; key IDs are implementation detail. Reference keys by alias in app config.
- **Default-key encryption locks you in.** Anything encrypted with `alias/aws/<service>` cannot be shared cross-account; use a customer-managed key from day one for anything you might ever move.

## When to use

- Reach for KMS implicitly through the encryption toggle on every service that supports encryption-at-rest. Reach for it explicitly when: you need cross-account sharing of encrypted resources, you want key-rotation control, or you need to call `Encrypt`/`Decrypt` directly for application-level secrets.

## Mental model

| Key kind                                | Who creates it                                                | Who controls the policy                      | Cross-account use?                              |
| --------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| **Customer-managed**                    | You                                                           | You (full control of key policy)             | Yes                                             |
| **AWS-managed** (`alias/aws/<service>`) | AWS, on demand when a service first needs one in your account | AWS (you can read the policy, can't edit it) | **No**: the policy is locked. This is the trap. |
| **AWS-owned**                           | AWS (shared across many customers)                            | AWS                                          | No (and invisible to you)                       |

Cross-account use needs **both** sides to agree: a statement in account A's key policy allowing the relevant actions for `Principal: { AWS: "arn:aws:iam::ACCOUNT_B:root" }`, AND an IAM policy on account B's principal granting the same actions on the key ARN (Amazon Resource Name, the `arn:aws:...` identifier that uniquely names every AWS resource). Granting only one side fails with near-identical `AccessDenied` messages, which is why this is a recurring footgun.

## Pending notes

- Customer-managed vs AWS-managed vs AWS-owned keys: which can be shared, which lock you in.
- Key policies vs IAM policies: why KMS treats the key policy as the primary authority.
- Cross-account use needs both sides to agree: key policy on the owner + IAM policy on the consumer.
- Aliases as the stable name; key IDs as implementation detail.

## See also

- [[aws/kms/cli|KMS CLI cheatsheet]]: create, alias, key-policy, schedule-deletion.
- [[aws/rds/cross-account-snapshot|Cross-account RDS snapshot]]: the canonical KMS cross-account recipe.
- [[aws/s3/cross-account-migration|Cross-account bucket migration]]: same pattern applied to S3 SSE-KMS.
- [AWS KMS developer guide](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) (official).
