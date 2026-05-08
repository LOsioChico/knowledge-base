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

> AWS Key Management Service (KMS) is the encryption-key broker used by every other AWS service that does encryption-at-rest: you create a key once, attach a policy that says who can use it, and then services like S3, [[aws/rds/index|RDS]], EBS (Elastic Block Store), and [[aws/secrets-manager|Secrets Manager]] call KMS on your behalf to encrypt + decrypt data keys.

This area is a placeholder. Day-to-day commands live in [[aws/kms/cli|KMS CLI cheatsheet]]; the canonical cross-account pattern shows up in [[aws/rds/cross-account-snapshot|RDS cross-account snapshot]].

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
