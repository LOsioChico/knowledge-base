---
title: IAM CLI cheatsheet
aliases: [aws iam cli, iam diagnostic commands]
tags: [type/reference, tech/aws, tech/aws-cli, tech/iam]
area: aws
status: evergreen
related:
  - "[[aws/cli/index]]"
  - "[[aws/cli/profiles-and-credentials]]"
  - "[[aws/iam]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
---

> Read-only [[aws/iam|IAM]] commands I reach for when chasing an unexpected `AccessDenied`. Most permission diagnostics start with "who is the caller?" and "what policies attach?" before doing anything destructive.

## Identity

```bash
# Who am I right now?
aws sts get-caller-identity --profile <profile>

# Assume a role manually (most useful for debugging trust policies)
aws sts assume-role \
  --role-arn arn:aws:iam::ACCOUNT_ID:role/<role> \
  --role-session-name dbg \
  --external-id <ExternalId>
```

## What policies attach to a principal?

```bash
# Users
aws iam list-attached-user-policies --user-name <user>
aws iam list-user-policies          --user-name <user>      # inline policies
aws iam list-groups-for-user        --user-name <user>
aws iam list-attached-group-policies --group-name <group>

# Roles
aws iam list-attached-role-policies --role-name <role>
aws iam list-role-policies          --role-name <role>      # inline
aws iam get-role                    --role-name <role> --query Role.AssumeRolePolicyDocument
```

## What does a managed policy actually allow?

```bash
aws iam get-policy         --policy-arn <arn>
aws iam get-policy-version --policy-arn <arn> --version-id v1
aws iam list-entities-for-policy --policy-arn <arn>
```

## Will <principal> be allowed to do X?

```bash
# Simulate against the same evaluation chain AWS uses
aws iam simulate-principal-policy \
  --policy-source-arn <principal-arn> \
  --action-names <service:Action> \
  --resource-arns <resource-arn>
```

The output names the matched statement, which is usually enough to spot the missing allow or unexpected deny.

## Access-key hygiene

```bash
aws iam list-access-keys           --user-name <user>
aws iam get-access-key-last-used   --access-key-id <AKIA...>
aws iam update-access-key          --user-name <user> --access-key-id <AKIA...> --status Inactive
aws iam delete-access-key          --user-name <user> --access-key-id <AKIA...>
```

## Tips

- Always `aws sts get-caller-identity` first; mismatched `--profile` is the most common cause of mystery denials. See [[aws/cli/profiles-and-credentials|profiles and credentials]].
- For cross-account `assume-role` from a profile, configure `role_arn` + `source_profile` in `~/.aws/config` instead of calling `sts assume-role` by hand. Same recipe at [[aws/recipes/cross-account-role-pattern|cross-account assume-role pattern]].
