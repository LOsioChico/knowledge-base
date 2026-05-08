---
title: Account migrations
aliases:
  - "AWS account migrations"
  - "aws cross-account migration"
  - "account migration playbook"
tags: [type/moc, tech/aws]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/recipes/cross-account-snapshot]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
  - "[[aws/recipes/alternate-domain-claim]]"
  - "[[aws/recipes/cross-account-app-migration]]"
  - "[[aws/recipes/ec2-snapshot-all-instances]]"
  - "[[aws/recipes/ec2-ami-cross-account-copy]]"
  - "[[aws/s3/cross-account-migration]]"
  - "[[aws/rds]]"
  - "[[aws/s3/index]]"
  - "[[aws/amplify]]"
  - "[[aws/cloudfront]]"
  - "[[aws/iam]]"
  - "[[aws/lambda]]"
  - "[[aws/kms]]"
  - "[[aws/secrets-manager]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/cli/kms-cheatsheet]]"
---

> When you move a workload from one AWS account to another, the same handful of service-level moves come up every time. This index is the cross-cutting playbook that points at each per-service recipe.

## When this playbook applies

- The workload's AWS account is changing (account compromise, ownership change, billing consolidation, sandbox graduation).
- One or more services in the workload are quarantined and you can only move some of them today.
- A second AWS account is taking over an existing workload and you need to keep the same DNS, the same data, and the same permissions wiring.

## Pre-flight (every migration)

1. Set up [[aws/cli/profiles-and-credentials|named CLI profiles]] for both accounts. Convention used in every recipe in this playbook: `account-a` (source), `account-b` (target).
2. Run `aws sts get-caller-identity --profile account-a` and `--profile account-b` and confirm the `Account` field matches what you expect. Mixing up profiles is the most expensive mistake.
3. Decide which services are moving today and which (if any) are staying in `account-a` temporarily. Anything staying needs the [[aws/recipes/cross-account-role-pattern|cross-account assume-role pattern]] so the new compute can still reach it.

## Per-service moves

| Service                        | Recipe                                      | What it covers                                                                                                          |
| ------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [[aws/rds\|RDS]]               | [[aws/recipes/cross-account-snapshot]]      | Encrypted snapshot share via re-encrypt with a customer-managed [[aws/kms\|KMS]] key (CMK) + restore in target account. |
| [[aws/s3/index\|S3]]           | [[aws/s3/cross-account-migration]]          | Recreate bucket config + cross-account `s3 sync`.                                                                       |
| [[aws/amplify\|Amplify]]       | [[aws/recipes/cross-account-app-migration]] | `create-app` → branch → manual zip deployment → domain-association move.                                                |
| [[aws/cloudfront\|CloudFront]] | [[aws/recipes/alternate-domain-claim]]      | The ghost-claim gotcha that bites every Amplify domain move; ACM-cert workaround.                                       |
| [[aws/iam\|IAM]]               | [[aws/recipes/cross-account-role-pattern]]  | Trust policy + ExternalId + scoped permissions for "new account assumes a role in old account".                         |
| [[aws/kms\|KMS]]               | [[aws/kms]]                                 | Key-policy + IAM-policy pattern that underlies cross-account RDS, S3, [[aws/secrets-manager\|Secrets Manager]].         |

## Recommended order

1. **CLI + identities**: profiles, `sts get-caller-identity` on both sides.
2. **IAM [[aws/recipes/cross-account-role-pattern|cross-account roles]]**: set them up early so the new account can talk to anything that's staying behind.
3. **Data services first** (RDS, S3): they take the longest to copy and have the largest rollback windows.
4. **Compute next** ([[aws/lambda|Lambda]], ECS): once the data is in place.
5. **Frontend + DNS last** (Amplify, CloudFront, Route53): flipping the domain is the user-visible cutover. Don't do this before the data and compute behind it are validated.
6. **Cleanup**: revoke cross-account grants, delete the source resources after a comfortable rollback window.

## Failure modes worth knowing about up front

- **Encrypted snapshots can't be shared with the default service KMS key.** [[aws/recipes/cross-account-snapshot|Recipe]] handles the re-encrypt step.
- **CloudFront alternate-domain claims linger after distribution deletion.** [[aws/recipes/alternate-domain-claim|Bypass with your own ACM cert]].
- **Cross-account KMS needs BOTH the owning-account key policy AND an IAM policy on the consumer principal** (the IAM user or role making the `Decrypt`/`Encrypt` call). Granting only one and wondering why it fails is universal.
- **`sts:AssumeRole` without `ExternalId` in the trust policy** is a confused-deputy attack (a third party tricking your role into acting on their behalf) waiting to happen. [[aws/recipes/cross-account-role-pattern|Always set one]].
- **Wrong `--profile` on a write command.** Run `aws sts get-caller-identity` first, every time.

## What's NOT in this playbook (yet)

These came up in the original migration and would benefit from their own recipes:

- API Gateway: export REST API as OpenAPI, recreate in target, repoint custom domain.
- Cognito: user-pool import via `cognito-idp create-user-import-job` (passwords are not portable; users have to reset).
- CloudFormation / SAM (Serverless Application Model) stack-level moves (CDK, the Cloud Development Kit, is a separate story).
- Lambda function migration with versioned aliases for zero-downtime cutover.
