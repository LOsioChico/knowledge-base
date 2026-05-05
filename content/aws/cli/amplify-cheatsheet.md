---
title: Amplify CLI cheatsheet
aliases: [aws amplify cli, amplify hosting commands]
tags: [type/reference, tech/aws, tech/aws-cli, tech/amplify]
area: aws
status: evergreen
related:
  - "[[aws/cli/index]]"
  - "[[aws/cli/cloudfront-cheatsheet]]"
  - "[[aws/amplify]]"
  - "[[aws/recipes/cross-account-app-migration]]"
---

> The four [[aws/amplify|Amplify Hosting]] primitive lifecycles (app, branch, deployment, domain) plus the inspection commands I use during a build failure or a domain-association move.

## App + branch lifecycle

```bash
# Inventory
aws amplify list-apps \
  --query 'apps[].{appId:appId,name:name,defaultDomain:defaultDomain,repository:repository}' \
  --output table

aws amplify get-app --app-id <APP_ID>

aws amplify create-app \
  --name <name> --platform WEB \
  --custom-rules '[{"source":"/<*>","target":"/index.html","status":"404-200"}]'

# Branches
aws amplify list-branches --app-id <APP_ID> \
  --query 'branches[].{branch:branchName,stage:stage,domain:displayName}' --output table

aws amplify get-branch --app-id <APP_ID> --branch-name <branch> \
  --query 'branch.environmentVariables'

aws amplify create-branch --app-id <APP_ID> --branch-name main --stage PRODUCTION
```

## Manual zip deployment (no git connection)

```bash
# 1. Get a presigned upload URL + jobId
aws amplify create-deployment --app-id <APP_ID> --branch-name main
# → returns { "zipUploadUrl": "...", "jobId": "..." }

# 2. Upload the build zip
curl --upload-file ./build.zip "$ZIP_UPLOAD_URL"

# 3. Kick off the deployment
aws amplify start-deployment --app-id <APP_ID> --branch-name main --job-id <JOB_ID>

# 4. Watch
aws amplify get-job --app-id <APP_ID> --branch-name main --job-id <JOB_ID> \
  --query 'job.{summary:summary,steps:steps[].{stepName:stepName,status:status,statusReason:statusReason,logUrl:logUrl}}'
```

## Git-connected build trigger

```bash
aws amplify start-job --app-id <APP_ID> --branch-name main --job-type RELEASE
```

## Domains

```bash
aws amplify list-domain-associations  --app-id <APP_ID>
aws amplify get-domain-association    --app-id <APP_ID> --domain-name <domain>

aws amplify create-domain-association \
  --app-id <APP_ID> --domain-name <domain> \
  --sub-domain-settings prefix=app,branchName=main

aws amplify update-domain-association \
  --app-id <APP_ID> --domain-name <domain> \
  --sub-domain-settings prefix=app,branchName=main

aws amplify delete-domain-association --app-id <APP_ID> --domain-name <domain>
```

## Webhooks

```bash
# For external CI to trigger a build
aws amplify list-webhooks --app-id <APP_ID>
aws amplify create-webhook --app-id <APP_ID> --branch-name main
```

## Tips

- The `WEB_COMPUTE` platform is required for Next.js SSR. `WEB` is static-only; if you set `WEB` on an SSR app, builds succeed but routes 404 at runtime.
- `start-deployment` is async. Poll `get-job` until `status` is `SUCCEED`/`FAILED`.
- For cross-account moves, the full sequence (with the domain-association handoff) is in [[aws/recipes/cross-account-app-migration|cross-account Amplify app migration]].
