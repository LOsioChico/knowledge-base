---
title: Amplify Hosting
aliases: [aws amplify, amplify hosting]
tags: [type/moc, tech/aws, tech/amplify]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/amplify/cross-account-app-migration]]"
  - "[[aws/cloudfront/alternate-domain-claim]]"
---

Notes on AWS Amplify Hosting: app, branch, deployment, and domain-association lifecycle, plus the cross-account move recipe.

## Notes

- [[aws/amplify/cross-account-app-migration|Cross-account Amplify app migration]]: end-to-end recipe: `create-app` → `create-branch` → `create-deployment` → `start-deployment` → domain-association move: when you're standing up the same frontend in a new AWS account.

## CLI cheat-sheet

```bash
# App + branch lifecycle
aws amplify list-apps           --query 'apps[].{appId:appId,name:name,defaultDomain:defaultDomain,repository:repository}' --output table
aws amplify get-app             --app-id <APP_ID>
aws amplify create-app          --name <name> --platform WEB --custom-rules '[{"source":"/<*>","target":"/index.html","status":"404-200"}]'
aws amplify list-branches       --app-id <APP_ID> --query 'branches[].{branch:branchName,stage:stage,domain:displayName}' --output table
aws amplify get-branch          --app-id <APP_ID> --branch-name <branch> --query 'branch.environmentVariables'
aws amplify create-branch       --app-id <APP_ID> --branch-name main --stage PRODUCTION

# Manual zip deployment (no git connection)
aws amplify create-deployment   --app-id <APP_ID> --branch-name main   # returns zipUploadUrl + jobId
aws amplify start-deployment    --app-id <APP_ID> --branch-name main --job-id <JOB_ID>
aws amplify get-job             --app-id <APP_ID> --branch-name main --job-id <JOB_ID> \
  --query 'job.{summary:summary,steps:steps[].{stepName:stepName,status:status,statusReason:statusReason,logUrl:logUrl}}'

# Git-connected build trigger
aws amplify start-job           --app-id <APP_ID> --branch-name main --job-type RELEASE

# Domains
aws amplify list-domain-associations --app-id <APP_ID>
aws amplify get-domain-association   --app-id <APP_ID> --domain-name <domain>
aws amplify create-domain-association --app-id <APP_ID> --domain-name <domain> --sub-domain-settings prefix=app,branchName=main
aws amplify update-domain-association --app-id <APP_ID> --domain-name <domain> --sub-domain-settings prefix=app,branchName=main
aws amplify delete-domain-association --app-id <APP_ID> --domain-name <domain>

# Webhooks (for external CI to trigger a build)
aws amplify list-webhooks       --app-id <APP_ID>
```
