---
title: IAM
aliases: [aws iam, identity and access management]
tags: [type/concept, tech/aws, tech/iam]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/iam/cli]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
  - "[[aws/kms/cli]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/kms/index]]"
  - "[[aws/lambda/index]]"
  - "[[aws/ecs/index]]"
  - "[[aws/s3/index]]"
  - "[[aws/secrets-manager]]"
  - "[[aws/s3/cross-account-migration]]"
  - "[[aws/rds/cross-account-snapshot]]"
  - "[[aws/s3/presigned-urls]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html
---

> AWS Identity and Access Management (IAM) is the authn + authz layer for everything else in AWS: every API call is evaluated against IAM before it touches the target service. Get IAM right and other services have a chance; get it wrong and nothing else matters.

This area is a placeholder. Triage commands live in [[aws/iam/cli|IAM CLI cheatsheet]]; the canonical cross-account pattern is [[aws/recipes/cross-account-role-pattern|cross-account assume-role]].

## Pending notes

- Principal taxonomy: root vs IAM users vs roles, and why long-lived access keys are an anti-pattern.
- Policy evaluation: identity vs resource policies, explicit deny precedence, SCPs/RCPs/permission boundaries as intersections.
- Cross-account `sts:AssumeRole` with `ExternalId`: defending against the confused-deputy problem.
- Diagnostic mindset for `AccessDenied`: who is the caller, what attaches, what denies, simulate.

## See also

- [[aws/iam/cli|IAM CLI cheatsheet]]: read-only commands for triaging an `AccessDenied`.
- [[aws/recipes/cross-account-role-pattern|Cross-account assume-role pattern]]: trust policy + ExternalId + scoped permissions.
- [IAM user guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html) (official).
