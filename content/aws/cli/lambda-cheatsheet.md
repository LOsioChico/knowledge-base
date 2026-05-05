---
title: Lambda CLI cheatsheet
aliases: [aws lambda cli, lambda commands]
tags: [type/reference, tech/aws, tech/aws-cli, tech/lambda]
area: aws
status: seed
related:
  - "[[aws/cli/index]]"
  - "[[aws/lambda]]"
---

> Function lifecycle, invoke, and the inspection commands that come up first during a triage. Seed cheatsheet: expand as [[aws/lambda|Lambda]] recipes land.

## Inventory

```bash
aws lambda list-functions \
  --query 'Functions[].{Name:FunctionName,Runtime:Runtime,Last:LastModified,Region:FunctionArn}' \
  --output table

aws lambda get-function          --function-name <name>
aws lambda get-function-configuration --function-name <name>
aws lambda get-account-settings  # quotas (concurrent execs, code storage)
```

## Create + update + delete

```bash
aws lambda create-function \
  --function-name <name> \
  --runtime nodejs20.x \
  --role <role-arn> \
  --handler index.handler \
  --zip-file fileb://function.zip

aws lambda update-function-code \
  --function-name <name> --zip-file fileb://function.zip

aws lambda update-function-configuration \
  --function-name <name> --environment 'Variables={KEY=value}'

aws lambda delete-function --function-name <name>
```

## Invoke

```bash
aws lambda invoke \
  --function-name <name> \
  --payload '{"k":"v"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/out.json
cat /tmp/out.json
```

`--cli-binary-format raw-in-base64-out` is required on AWS CLI v2 for `--payload` to be sent as JSON instead of being base64-decoded first.

## Versions + aliases

```bash
# Publish an immutable version
aws lambda publish-version --function-name <name>

# Point an alias at a version (or shift traffic between two versions)
aws lambda update-alias \
  --function-name <name> --name prod --function-version 7 \
  --routing-config 'AdditionalVersionWeights={"8"=0.10}'  # 10% to v8

aws lambda list-aliases --function-name <name>
```

## Tips

- Always reference Lambda from triggers (API Gateway, EventBridge) by **alias**, not version. Lets you cut over without touching the trigger.
- Prefer `update-function-code` + `publish-version` over editing the latest function in place; versions are your audit trail.
