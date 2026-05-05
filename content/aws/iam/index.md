---
title: IAM
aliases: [aws iam, identity and access management]
tags: [type/moc, tech/aws, tech/iam]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/iam/cross-account-role-pattern]]"
---

Notes on AWS Identity and Access Management: identities, roles, trust policies, and the diagnostic commands that turn an opaque `AccessDenied` into a fix.

## Notes

- [[aws/iam/cross-account-role-pattern|Cross-account assume-role pattern]]: when one service can't migrate yet, leave it in the old account and let the new account's compute reach it via [[aws/iam/cross-account-role-pattern|STS AssumeRole]] + ExternalId.

## Diagnostic CLI cheat-sheet

When chasing an unexpected `AccessDenied`, these are the read-only commands that almost always come up first:

```bash
# Who am I?
aws sts get-caller-identity --profile <profile>

# What policies are attached to a user?
aws iam list-attached-user-policies --user-name <user>
aws iam list-user-policies          --user-name <user>   # inline policies
aws iam list-groups-for-user        --user-name <user>
aws iam list-attached-group-policies --group-name <group>

# What does a managed policy actually allow?
aws iam get-policy   --policy-arn <arn>
aws iam list-entities-for-policy --policy-arn <arn>

# Will <principal> be allowed to do <action> on <resource>?
aws iam simulate-principal-policy \
  --policy-source-arn <principal-arn> \
  --action-names <service:Action> \
  --resource-arns <resource-arn>

# Access-key hygiene
aws iam list-access-keys           --user-name <user>
aws iam get-access-key-last-used   --access-key-id <AKIA...>
```
