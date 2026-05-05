---
title: AWS CLI profiles and credentials
aliases: [aws profiles, named profiles, aws credentials file]
tags: [type/concept, tech/aws, tech/aws-cli, tech/sts]
area: aws
status: evergreen
source:
  - https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html
  - https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html
  - https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html
related:
  - "[[aws/cli/index]]"
  - "[[aws/cli/query-and-output]]"
  - "[[aws/cli/s3]]"
  - "[[aws/cli/iam-cheatsheet]]"
  - "[[aws/cli/rds-cheatsheet]]"
  - "[[aws/iam]]"
  - "[[aws/kms]]"
  - "[[aws/rds]]"
  - "[[aws/account-migrations]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
---

> Use named CLI profiles to drive multiple AWS accounts from one shell; verify which account each profile resolves to with `aws sts get-caller-identity` before any write.

## Profile shape

[Named profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html) live in `~/.aws/config` (settings) and `~/.aws/credentials` (long-lived keys, when used). The CLI selects a profile via `--profile <name>` or the `AWS_PROFILE` env var; without either, it uses `default`.

```ini
# ~/.aws/config
[profile pentica]
region = us-east-1
output = json

[profile we4labs]
region = us-east-1
output = json
```

```ini
# ~/.aws/credentials
[pentica]
aws_access_key_id = AKIA...
aws_secret_access_key = ...

[we4labs]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
```

For single sign-on (SSO)-backed profiles, [`aws configure sso`](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html) writes the `sso_session` block and you authenticate with `aws sso login --profile <name>`; no long-lived keys live on disk.

## Inspect what's configured

```bash
# All profile names known to this shell (CLI v2)
aws configure list-profiles

# Show the active profile's resolved settings (region, output, source of credentials)
aws configure list --profile pentica

# Read a single config value
aws configure get region --profile pentica
```

> [!warning] `aws configure list-profiles` is CLI v2 only
> The subcommand is documented under v2 ([source](https://docs.aws.amazon.com/cli/latest/reference/configure/list-profiles.html)) and absent from the v1 `configure` reference ([source](https://docs.aws.amazon.com/cli/v1/reference/configure/)). If it errors out, read `~/.aws/credentials` and `~/.aws/config` directly, or upgrade to v2.

## Confirm which account a profile points at

The most expensive mistake when juggling profiles is running a write against the wrong account. [`aws sts get-caller-identity`](https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html) is the universal pre-flight check: it returns the account, ARN (Amazon Resource Name), and UserId for whichever credentials the CLI just resolved.

```bash
aws sts get-caller-identity --profile pentica --output json
# {
#   "UserId": "AIDA...",
#   "Account": "123456789012",
#   "Arn": "arn:aws:iam::123456789012:user/developer-administrator"
# }

aws sts get-caller-identity --profile we4labs --query Arn --output text
```

Run this for every profile you're about to use, every time you start a new shell session, before any [[aws/kms|KMS]], [[aws/iam|IAM]], or [[aws/rds|RDS]] write.

## Common patterns

- **Per-shell pinning**: `export AWS_PROFILE=pentica` at the top of a session, then drop `--profile` from individual commands. Easier to read, but `sts get-caller-identity` is still mandatory.
- **Per-command profile + region**: `aws --profile we4labs --region us-east-1 <service> <verb>` makes each command self-contained, which is what to use in shared snippets and runbooks.
- **Cross-account assume-role**: a base profile with credentials, plus a derived profile with `role_arn` + `source_profile` in `~/.aws/config`. The CLI calls `sts:AssumeRole` transparently. See [[aws/recipes/cross-account-role-pattern|the cross-account role pattern]] for the trust-policy and external-id details.

## Order of credential resolution

The CLI walks the standard chain: explicit env vars (`AWS_ACCESS_KEY_ID`, ...) → `--profile` flag → `AWS_PROFILE` → `default` profile → the instance metadata service (IMDS) on EC2. The first source that yields a usable identity wins, and `sts get-caller-identity` will tell you exactly which one.
