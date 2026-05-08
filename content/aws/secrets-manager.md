---
title: Secrets Manager
aliases: [aws secrets manager, secretsmanager]
tags: [type/concept, tech/aws, tech/secrets-manager]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/iam]]"
  - "[[aws/kms]]"
  - "[[aws/lambda]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
  - "[[aws/recipes/s3-presigned-urls]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html
  - https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_examples_cross.html
  - https://docs.aws.amazon.com/secretsmanager/latest/userguide/troubleshoot.html
---

> AWS Secrets Manager stores small named blobs (database credentials, API tokens, OAuth client secrets) encrypted under a [[aws/kms|KMS]] key, and exposes them through `GetSecretValue` so applications never have to ship a credential in environment variables or config files.

## Mental model

A **secret** is a name + a versioned value (string or binary, ≤64 KB) + a KMS key reference. You read it via the secret's name or ARN; AWS resolves the current version, decrypts under the KMS key, and returns the plaintext to a permitted caller. Versions are immutable and tagged with stages (`AWSCURRENT`, `AWSPREVIOUS`, `AWSPENDING` during rotation).

Two pieces of access control:

- **[[aws/iam|IAM]] identity policy** on the caller (user/role) granting `secretsmanager:GetSecretValue` on the secret's ARN.
- **Resource policy** attached to the secret itself (optional; required for cross-account).

Plus a third gate: the **KMS key policy** on the encryption key. Reading a secret means decrypting it, which means the caller also needs `kms:Decrypt` on the underlying key.

## Secret ARNs end in a six-character random suffix

Every secret ARN looks like:

```
arn:aws:secretsmanager:us-east-2:111122223333:secret:MySecret-nutBrk
                                                     ^^^^^^^^ ^^^^^^
                                                     name     six random chars
```

Secrets Manager appends the trailing `-XXXXXX` automatically to make ARNs unique across delete/recreate cycles ([source](https://docs.aws.amazon.com/secretsmanager/latest/userguide/troubleshoot.html)). If you delete `MySecret` and create a new secret with the same name, the new ARN gets a different suffix, so consumers that hardcoded the old ARN fail closed instead of silently reading the new secret. Useful safety property; constant footgun in IAM policies.

> [!warning] Use a wildcard suffix in IAM policies, not the exact ARN
> The random suffix is invisible at create time and changes if the secret is ever recreated. An IAM policy pinned to the exact ARN breaks the next time someone deletes and re-adds the secret (rotation tooling, infra-as-code teardown, accidental deletion + restore from a different state file).
>
> Forbidden:
>
> ```json
> {
>   "Effect": "Allow",
>   "Action": "secretsmanager:GetSecretValue",
>   "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:db/prod/admin-AbCdEf"
> }
> ```
>
> Required:
>
> ```json
> {
>   "Effect": "Allow",
>   "Action": "secretsmanager:GetSecretValue",
>   "Resource": "arn:aws:secretsmanager:us-east-1:123456789012:secret:db/prod/admin-*"
> }
> ```
>
> The `-*` matches the auto-generated suffix and any future re-created suffix for the same logical secret. Tighten further by giving each environment its own secret-name prefix (`db/prod/`, `db/staging/`) and granting the policy on the prefix wildcard so a single role can read every secret under its scope.

The "hyphen plus six characters" suffix also breaks partial-ARN lookups: if your secret name itself ends in a hyphen and six characters (`MySecret-abcdef`), an `aws secretsmanager describe-secret --secret-id arn:...:secret:MySecret-abcdef` call can be misread as a full ARN and return `ResourceNotFoundException` ([source](https://docs.aws.amazon.com/secretsmanager/latest/userguide/troubleshoot.html)). Pass the full ARN with the random suffix, or just the name without any hyphen-six trailer.

## Cross-account access needs three policies

To let a role in account B read a secret owned by account A, all three of these must agree ([source](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_examples_cross.html)):

| Policy                               | Lives in  | Allows                                                                                          |
| ------------------------------------ | --------- | ----------------------------------------------------------------------------------------------- |
| Resource policy on the secret        | Account A | `secretsmanager:GetSecretValue` for `Principal: { AWS: "arn:aws:iam::ACCOUNT_B:role/Caller" }`. |
| Key policy on the encryption KMS key | Account A | `kms:Decrypt` + `kms:DescribeKey` for the same Account-B principal.                             |
| Identity policy on the caller in B   | Account B | `secretsmanager:GetSecretValue` on the secret ARN + `kms:Decrypt` on the key ARN.               |

Missing any one fails closed with `AccessDeniedException` from whichever layer caught it; the messages don't always make it obvious which layer rejected, which is why "I checked the IAM policy" is not enough debugging on its own.

> [!warning] Cross-account requires a customer-managed KMS key
> The default `aws/secretsmanager` AWS-managed key cannot be used cross-account ([source](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access_examples_cross.html)). If you accept the default at create time, the secret is locked into its owning account; the only fix is to re-encrypt the secret under a customer-managed key, which means creating a new secret (you cannot rewrap an existing one without going through the value). Same lock-in pattern as [[aws/kms#Cross-account use needs both sides to agree|other KMS-encrypted resources]].

Not every Secrets Manager API supports cross-account calls. The full list is enumerated under "Cross-account permission is effective only for the following operations" in the official cross-account guide; the common ones (`GetSecretValue`, `DescribeSecret`, `PutSecretValue`, `RotateSecret`, `TagResource`) are covered, while account-management actions (`CreateSecret`, `ListSecrets`) are not.

## Multi-consumer secrets: prefer multiple secrets over shared credentials

When two workloads need access to the same downstream system (e.g. two applications connecting to the same database), the temptation is one shared secret with both apps reading it. The cleaner shape is **one secret per consumer + per credential** even if the credentials end up identical. Reasons:

- Each consumer's IAM scope stays minimal: app A can read only `app-a/*`, not the whole shared bucket of secrets.
- Rotating one consumer's credential doesn't ripple through the other.
- An IAM audit can answer "who can read this credential?" by name, not by reverse-mapping which roles permit the shared secret.

When the underlying system requires the credentials to actually be the same (a single database user shared by two apps), you can still keep two Secrets Manager entries that happen to hold the same value, and rotate them in lockstep. The IAM separation is the win.

## Operational defaults

For any new secret:

- **Pick a customer-managed KMS key explicitly** at create time, even for single-account use. The cost is one extra KMS key (~$1/month). The value is the option to share cross-account later without the re-encrypt dance ([[aws/kms|same lesson as KMS]]).
- **Name with a hierarchical prefix** (`<env>/<system>/<role>`, e.g. `prod/orders-db/admin`). IAM policies grant on the prefix wildcard; rotation doesn't break consumers; multi-team accounts stay readable.
- **Always use `<name>-*` in IAM policies**, never the exact ARN with suffix.
- **Tag with `Owner` and `Environment`** so cost allocation and access reviews work without renaming.
- **Enable rotation only when there's a tested rotation [[aws/lambda|Lambda]] for the credential type**. Half-configured rotation that fails silently is worse than no rotation.

## See also

- [[aws/kms|KMS]]: Secrets Manager always encrypts under a KMS key; the cross-account dance is mostly a KMS dance.
- [[aws/iam|IAM]]: identity-policy half of every secret-access decision.
- [[aws/recipes/cross-account-role-pattern|Cross-account assume-role pattern]]: alternative when you don't want the secret to leave its owning account at all.
- [AWS Secrets Manager user guide](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html) (official).
