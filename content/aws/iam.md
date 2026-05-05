---
title: IAM
aliases: [aws iam, identity and access management]
tags: [type/concept, tech/aws, tech/iam]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/cli/iam-cheatsheet]]"
  - "[[aws/cli/kms-cheatsheet]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/kms]]"
  - "[[aws/lambda]]"
  - "[[aws/s3]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
  - "[[aws/recipes/cross-account-bucket-migration]]"
  - "[[aws/recipes/cross-account-snapshot]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html
  - https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html
---

> AWS Identity and Access Management (IAM) is the authn + authz layer for everything else in AWS: every API call is evaluated against IAM before it touches the target service. Get IAM right and other services have a chance; get it wrong and nothing else matters.

## Mental model

Every AWS API call is signed by a **principal** (an IAM user, an IAM role session, or the account root) and evaluated against a stack of policies before the target service ever sees it. A few services ([[aws/s3|Amazon S3]], AWS STS: Security Token Service) accept anonymous requests as a documented exception ([source](https://docs.aws.amazon.com/IAM/latest/UserGuide/intro-structure.html)); for everything else, IAM answers exactly two questions on each call: "who is the caller?" (authentication via signed request) and "is this caller allowed to perform this action on this resource right now?" (authorization via [policy evaluation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)).

Principals you'll touch directly come in three shapes (the JSON `Principal` element [recognizes more](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_principal.html#Principal_specifying): role sessions, federated users, AWS service principals, and `"*"` for any principal):

| Principal kind | Long-lived credentials?                          | Use for                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Root user**  | Yes (account password + access keys)             | Only the [tasks that require root credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html#root-user-tasks) (account close, billing settings, a handful of others). Then never again. |
| **IAM user**   | Yes (password, access keys)                      | Avoid for new workloads. Real humans should federate via IAM Identity Center (the AWS-managed single sign-on, SSO, service, formerly AWS SSO).                                                               |
| **IAM role**   | No (assumed; STS issues short-lived credentials) | Default choice. EC2/ECS/[[aws/lambda\|Lambda]] use instance/task/execution roles; humans assume roles via SSO; cross-account access is `sts:AssumeRole`.                                                     |

## Policies

Permissions live on **policies**, JSON documents that grant or deny actions on resources. Two flavors:

- **Identity-based policies** attach to a user, group, or role and say "this principal can do X on Y".
- **Resource-based policies** attach to a resource (S3 bucket, [[aws/kms|KMS]] key, SNS topic, IAM role trust policy) and say "these principals can do X on me". This is what makes cross-account access possible without first creating a user in the other account.

Evaluation rule of thumb: an action is allowed only if **at least one** policy explicitly allows it AND **no** policy explicitly denies it. Default is deny. Service Control Policies (SCPs, org-level), Resource Control Policies (RCPs, org-level), and permission boundaries are evaluated as **intersections** with the identity policy: for an Organizations member account, an action must be allowed by all of them ([source](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)). The mental model "they subtract, never add" is correct in effect because intersection cannot expand the allow set.

## Cross-account access

Two principals in two accounts cannot talk directly. The bridge is **`sts:AssumeRole`**: account A defines a role with a trust policy that allows account B's principals to assume it; account B's principal calls `sts:AssumeRole`, gets short-lived credentials, and then acts as that role inside account A. Always pin an `ExternalId` in the trust policy to defend against the [confused-deputy problem](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html).

End-to-end recipe: [[aws/recipes/cross-account-role-pattern|cross-account assume-role pattern]].

> [!warning] Roles, not users, for everything that runs code
> Long-lived access keys on an IAM user are the most common credential-leak vector in incident reports. EC2/ECS/Lambda should always run under a role; humans should always federate. The only legitimate IAM-user access keys are continuous-integration (CI) bots that genuinely cannot use OpenID Connect (OIDC) federation, and even those should be rotated.

## Diagnostic mindset

Most "why does this fail with `AccessDenied`?" questions resolve by asking, in order:

1. **Who is the caller?** `aws sts get-caller-identity` confirms which principal AWS sees. Wrong CLI profile is the #1 cause of mystery denials.
2. **What policies attach to that principal?** Identity policies (managed, reusable across principals, plus inline, embedded in one principal) AND group memberships AND any session policies (extra constraints injected at `AssumeRole` time, can only narrow, never widen).
3. **What does the resource policy say?** S3 buckets, KMS keys, and SNS topics can deny even when the identity policy allows.
4. **Is there an explicit deny somewhere up the chain?** Service control policies (SCPs), resource control policies (RCPs), permission boundaries, and session policies all subtract.
5. **Simulate.** `iam simulate-principal-policy` evaluates the same chain AWS does and tells you which statement decided the call.

The exact commands are in the [[aws/cli/iam-cheatsheet|IAM CLI cheatsheet]].

## See also

- [[aws/cli/iam-cheatsheet|IAM CLI cheatsheet]]: the read-only commands I reach for when triaging an `AccessDenied`.
- [[aws/recipes/cross-account-role-pattern|Cross-account assume-role pattern]]: trust policy + ExternalId + scoped permissions.
- [IAM user guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html) (official).
