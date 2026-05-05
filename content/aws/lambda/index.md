---
title: Lambda
aliases: [aws lambda]
tags: [type/moc, tech/aws, tech/lambda]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/migrations/index]]"
---

Notes on AWS Lambda: function lifecycle, region pinning, and the diagnostic commands that help when access starts failing for non-obvious reasons.

## CLI cheat-sheet

```bash
# Inventory
aws lambda list-functions --query 'Functions[].{Name:FunctionName,Runtime:Runtime,Last:LastModified,Region:FunctionArn}' --output table
aws lambda get-function   --function-name <name>
aws lambda get-account-settings   # quotas (concurrent execs, code storage)

# Create + invoke
aws lambda create-function --function-name <name> --runtime nodejs20.x --role <role-arn> --handler index.handler --zip-file fileb://function.zip
aws lambda invoke          --function-name <name> --payload '{"k":"v"}' /tmp/out.json
```

## Pending notes

- Cross-account Lambda migration: package, recreate function, repoint event sources, swap aliases for zero-downtime cutover.
- Region-pinned `AccessDenied`: when `aws lambda list-functions --region <r>` fails on one region but works on another, what to check first (SCP boundary, account-level deny, expired SSO session).
