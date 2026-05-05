---
title: KMS CLI cheatsheet
aliases: [aws kms cli, kms commands]
tags: [type/reference, tech/aws, tech/aws-cli, tech/kms]
area: aws
status: evergreen
related:
  - "[[aws/cli/index]]"
  - "[[aws/kms]]"
  - "[[aws/iam]]"
  - "[[aws/rds]]"
  - "[[aws/recipes/cross-account-snapshot]]"
  - "[[aws/account-migrations]]"
---

> Key creation, aliasing, policy edits, and deletion. Most [[aws/kms|KMS]] work is read-only inspection plus the occasional cross-account policy edit; you rarely call `encrypt`/`decrypt` directly because services do it for you.

## Create + label

```bash
aws kms create-key --description "<purpose>" --query KeyMetadata.KeyId --output text
aws kms create-alias --alias-name alias/<name> --target-key-id <KEY_ID>

aws kms list-aliases --key-id <KEY_ID> --query 'Aliases[].AliasName' --output json
```

## Inspect

```bash
aws kms describe-key --key-id <KEY_ID> \
  --query 'KeyMetadata.{Arn:Arn,KeyManager:KeyManager,KeyState:KeyState,Description:Description}' \
  --output json

# What does the key policy actually say?
aws kms get-key-policy --key-id <KEY_ID> --policy-name default

# Who's been using it lately? (CloudTrail, not KMS, but the question always comes up here)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=<KEY_ARN> \
  --max-results 20
```

`KeyManager` distinguishes `CUSTOMER` (you can edit the policy and share cross-account) from `AWS` (you can't).

## Edit the key policy

```bash
# 1. Pull current policy
aws kms get-key-policy --key-id <KEY_ID> --policy-name default \
  --query Policy --output text > cmk-policy.json

# 2. Edit cmk-policy.json (e.g. add a Statement allowing Account B to Decrypt)

# 3. Push it back (default is the only valid policy-name)
aws kms put-key-policy --key-id <KEY_ID> --policy-name default --policy file://cmk-policy.json
```

`put-key-policy` is read-modify-write with no concurrency token; coordinate manually if you have multiple editors.

## Cleanup

```bash
# Soft-delete: 7-30 day window during which the key can be cancelled
aws kms schedule-key-deletion --key-id <KEY_ID> --pending-window-in-days 7

aws kms cancel-key-deletion   --key-id <KEY_ID>

# Disable without scheduling deletion (no waiting period to re-enable)
aws kms disable-key --key-id <KEY_ID>
aws kms enable-key  --key-id <KEY_ID>
```

> [!warning] You cannot undo `delete-alias` + `delete-key` lite
> There's no `delete-key`. The only way to remove a key is `schedule-key-deletion`, and even after the window elapses there's no way to recover. Anything encrypted with that key becomes permanently undecryptable. For a key you might want back: `disable-key` instead, then re-enable when needed.

## Tips

- Always reference keys by **alias** in application config; aliases are re-pointable, key IDs are not.
- For cross-account use, the key-policy edit on the owner side AND the [[aws/iam|IAM]]-policy edit on the consumer side are both required. Full walkthrough on the [[aws/rds|RDS]] side: [[aws/recipes/cross-account-snapshot|cross-account snapshot]].
