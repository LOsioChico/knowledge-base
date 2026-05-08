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
  - "[[aws/s3/quickstart]]"
  - "[[aws/secrets-manager]]"
  - "[[aws/s3/cross-account-migration]]"
  - "[[aws/rds/cross-account-snapshot]]"
  - "[[aws/s3/presigned-urls]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html
---

> AWS Identity and Access Management (IAM) is the authn + authz layer for everything else in AWS: every API call is evaluated against IAM before it touches the target service. Get IAM right and other services have a chance; get it wrong and nothing else matters.

## TL;DR

- **Every API call is signed by a principal** (user, role session, or root) and evaluated against a stack of policies. Default is deny.
- **Identity-based policies** attach to a user/group/role; **resource-based policies** attach to a resource (S3 bucket, KMS key, role trust policy). An action is allowed only if at least one allows AND no policy denies.
- **Cross-account access is `sts:AssumeRole`**: account A defines a role with a trust policy that allows account B's principals; B calls AssumeRole, gets short-lived credentials.
- **Roles, not users, for code.** Long-lived IAM-user access keys are the most common credential-leak vector. EC2/ECS/Lambda use roles; humans federate via IAM Identity Center.
- **SCPs / RCPs / permission boundaries are intersections** with the identity policy: they subtract, never add.

## When to use

- IAM is non-optional: it gates every other service. The relevant question is which **principal kind** to use (root → only the locked-down account-root tasks; IAM user → avoid for new workloads; role → default for everything that runs code or federates a human).

## Mental model

| Principal kind | Long-lived credentials?                          | Use for                                                                                                                                                 |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Root user**  | Yes (account password + access keys)             | Only the handful of tasks that require root. Then never again.                                                                                          |
| **IAM user**   | Yes (password, access keys)                      | Avoid for new workloads. Real humans should federate via IAM Identity Center (formerly AWS SSO).                                                        |
| **IAM role**   | No (assumed; STS issues short-lived credentials) | Default choice. EC2/ECS/[[aws/lambda/index\|Lambda]] use instance/task/execution roles; humans assume roles via SSO; cross-account is `sts:AssumeRole`. |

## Pending notes

- Principal taxonomy: root vs IAM users vs roles, and why long-lived access keys are an anti-pattern.
- Policy evaluation: identity vs resource policies, explicit deny precedence, SCPs/RCPs/permission boundaries as intersections.
- Cross-account `sts:AssumeRole` with `ExternalId`: defending against the confused-deputy problem.
- Diagnostic mindset for `AccessDenied`: who is the caller, what attaches, what denies, simulate.

## See also

- [[aws/iam/cli|IAM CLI cheatsheet]]: read-only commands for triaging an `AccessDenied`.
- [[aws/recipes/cross-account-role-pattern|Cross-account assume-role pattern]]: trust policy + ExternalId + scoped permissions.
- [IAM user guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html) (official).
