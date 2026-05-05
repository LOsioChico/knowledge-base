---
title: Cross-account Amplify app migration
aliases: [amplify cross-account, amplify migrate app, amplify zip deploy]
tags: [type/recipe, tech/aws, tech/amplify, tech/cloudfront, tech/acm]
area: aws
status: evergreen
source:
  - https://docs.aws.amazon.com/cli/latest/reference/amplify/create-deployment.html
  - https://docs.aws.amazon.com/cli/latest/reference/amplify/start-deployment.html
related:
  - "[[aws/amplify]]"
  - "[[aws/cloudfront]]"
  - "[[aws/recipes/index]]"
  - "[[aws/recipes/alternate-domain-claim]]"
  - "[[aws/cli/amplify-cheatsheet]]"
  - "[[aws/migrations/index]]"
---

> Recreate an [[aws/amplify|Amplify Hosting]] app in a new AWS account by `create-app` → `create-branch` → manual zip deployment via `create-deployment` + `start-deployment`, then move the custom domain. The custom-rules JSON, build env vars, and domain association are all CLI-driven so the move is reproducible.

## When to use this recipe

- The Amplify-hosted frontend has to live in a new AWS account (account ownership change, billing split, sandbox graduation).
- The git connection in the source app uses an OAuth token tied to a person who's leaving: easier to skip the git connection on the new app and push deployments via zip from CI you already control.
- You want a deterministic, scriptable migration so you can dry-run it in a staging account first.

## Recipe

Uses two named CLI profiles, `account-a` (source) and `account-b` (target). Replace `<APP_NAME>`, `<APP_ID>`, `<DOMAIN>`, `<JOB_ID>` as needed.

### Pre-flight

```bash
aws sts get-caller-identity --profile account-a --output json
aws sts get-caller-identity --profile account-b --output json
```

Confirm the active region matches the source app's region (Amplify domain associations are regional and provision us-east-1 ACM certs even when the app lives elsewhere).

### 1. Inventory the source app

You'll need to copy the custom rewrites, build environment variables, and the branch shape into the new account.

```bash
# Identify the source app + its build settings
aws amplify list-apps \
  --profile account-a --region us-east-1 \
  --query 'apps[].{appId:appId,name:name,defaultDomain:defaultDomain,repository:repository}' \
  --output table

aws amplify get-app \
  --profile account-a --region us-east-1 \
  --app-id <SOURCE_APP_ID> \
  --query 'app.{name:name,platform:platform,customRules:customRules,buildSpec:buildSpec,envVars:environmentVariables}' \
  --output json > source-app.json

# Per-branch env vars (these usually differ from app-level vars)
aws amplify list-branches \
  --profile account-a --region us-east-1 \
  --app-id <SOURCE_APP_ID> \
  --query 'branches[].{branch:branchName,stage:stage,active:enableAutoBuild}' \
  --output table

aws amplify get-branch \
  --profile account-a --region us-east-1 \
  --app-id <SOURCE_APP_ID> --branch-name main \
  --query 'branch.environmentVariables' \
  --output json > source-branch-envs.json
```

### 2. Create the app in account B

The `--custom-rules` value is the SPA rewrite that returns `index.html` for any unmatched path with a 404→200 status code; without it client-side routing breaks on hard refresh ([Amplify rewrites and redirects](https://docs.aws.amazon.com/amplify/latest/userguide/redirects.html)).

```bash
NEW_APP_ID=$(aws amplify create-app \
  --profile account-b --region us-east-1 \
  --name <APP_NAME> \
  --platform WEB \
  --custom-rules '[{"source":"/<*>","target":"/index.html","status":"404-200"}]' \
  --query 'app.appId' --output text)

echo "$NEW_APP_ID"
```

### 3. Create the production branch

Branch stage is the only required field beyond the name; everything else can be set after.

```bash
aws amplify create-branch \
  --profile account-b --region us-east-1 \
  --app-id "$NEW_APP_ID" \
  --branch-name main \
  --stage PRODUCTION \
  --query 'branch.branchName' --output text
```

If the source had branch-level env vars (`source-branch-envs.json` from step 1), apply them with [`update-branch`](https://docs.aws.amazon.com/cli/latest/reference/amplify/update-branch.html):

```bash
aws amplify update-branch \
  --profile account-b --region us-east-1 \
  --app-id "$NEW_APP_ID" \
  --branch-name main \
  --environment-variables file://source-branch-envs.json
```

### 4. Manual zip deployment

This avoids wiring a git connection. Build the frontend locally (or in CI), zip the output directory, then ask Amplify for an upload URL and start the deployment ([`create-deployment`](https://docs.aws.amazon.com/cli/latest/reference/amplify/create-deployment.html), [`start-deployment`](https://docs.aws.amazon.com/cli/latest/reference/amplify/start-deployment.html)):

```bash
# Build + zip locally (Vue/Nuxt/Next/etc.)
pnpm install && pnpm build
cd dist && zip -r ../build.zip . && cd ..

# Get a presigned upload URL + jobId
DEPLOY=$(aws amplify create-deployment \
  --profile account-b --region us-east-1 \
  --app-id "$NEW_APP_ID" --branch-name main \
  --query '{jobId:jobId,zipUploadUrl:zipUploadUrl}' --output json)

JOB_ID=$(echo "$DEPLOY" | jq -r .jobId)
UPLOAD_URL=$(echo "$DEPLOY" | jq -r .zipUploadUrl)

# Push the zip to the presigned URL (no auth needed; URL is the credential)
curl -X PUT -T build.zip "$UPLOAD_URL"

# Trigger the deployment
aws amplify start-deployment \
  --profile account-b --region us-east-1 \
  --app-id "$NEW_APP_ID" --branch-name main \
  --job-id "$JOB_ID" \
  --query 'jobSummary.{jobId:jobId,status:status}' --output json
```

### 5. Watch the build to completion

```bash
aws amplify get-job \
  --profile account-b --region us-east-1 \
  --app-id "$NEW_APP_ID" --branch-name main --job-id "$JOB_ID" \
  --query 'job.summary.{status:status,startTime:startTime,endTime:endTime}' \
  --output table

# If it fails, full step-level breakdown with log URLs
aws amplify get-job \
  --profile account-b --region us-east-1 \
  --app-id "$NEW_APP_ID" --branch-name main --job-id "$JOB_ID" \
  --query 'job.{summary:summary,steps:steps[].{stepName:stepName,status:status,statusReason:statusReason,logUrl:logUrl}}' \
  --output json
```

The default Amplify URL `https://main.<NEW_APP_ID>.amplifyapp.com` is live as soon as `status: SUCCEED`. Use it to smoke-test before you point the real domain at the new app.

### 6. Move the custom domain

This is where the [[aws/recipes/alternate-domain-claim|alternate-domain ghost-claim]] gotcha hits. Read that note before deleting anything in account A.

```bash
# Inspect the source association first; capture the subdomain prefixes you'll need to recreate
aws amplify list-domain-associations \
  --profile account-a --region us-east-1 \
  --app-id <SOURCE_APP_ID> \
  --query 'domainAssociations[].{domain:domainName,status:domainStatus,subDomains:subDomains[].subDomainSetting}' \
  --output json

# Detach from the source app (releases the alias for the new app to claim)
aws amplify delete-domain-association \
  --profile account-a --region us-east-1 \
  --app-id <SOURCE_APP_ID> \
  --domain-name <DOMAIN> \
  --query 'domainAssociation.domainStatus' --output text
```

Now, in account B, attach the domain. If you have an ACM cert that covers the alias, pass it explicitly to bypass the alternate-domain ghost-claim trap:

```bash
# Optional but strongly recommended on the second-and-later attempts: BYO certificate
CERT_ARN=$(aws acm request-certificate \
  --profile account-b --region us-east-1 \
  --domain-name <DOMAIN> \
  --subject-alternative-names "*.<DOMAIN>" \
  --validation-method DNS \
  --query CertificateArn --output text)

aws acm describe-certificate \
  --profile account-b --region us-east-1 \
  --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord' --output table
# (Add the validation CNAMEs to DNS, then wait)

aws acm wait certificate-validated \
  --profile account-b --region us-east-1 \
  --certificate-arn "$CERT_ARN"

# Attach the domain (with custom cert if you went that route)
aws amplify create-domain-association \
  --profile account-b --region us-east-1 \
  --app-id "$NEW_APP_ID" \
  --domain-name <DOMAIN> \
  --sub-domain-settings 'prefix=app,branchName=main' \
  --certificate-settings type=CUSTOM,customCertificateArn=$CERT_ARN
```

### 7. Watch the association settle

```bash
aws amplify get-domain-association \
  --profile account-b --region us-east-1 \
  --app-id "$NEW_APP_ID" --domain-name <DOMAIN> \
  --query 'domainAssociation.{status:domainStatus,reason:statusReason,verified:subDomains[0].verified,dns:subDomains[0].dnsRecord}' \
  --output json
```

Expected progression: `PENDING_VERIFICATION` → `IN_PROGRESS` / `UPDATING` → `AVAILABLE`. The `dns:subDomains[0].dnsRecord` field is the CNAME you must add at your DNS provider; once it propagates and the cert validates, the association flips to `AVAILABLE`.

### 8. Cut traffic over

Update the production CNAME(s) at your DNS provider to point at the new app's [[aws/cloudfront|CloudFront]] target (`d<RANDOM>.cloudfront.net`, visible in `get-domain-association` output). Verify with `dig` and a fresh browser before deleting the source app.

## Cleanup

After traffic is on the new app and you're confident in rollback windows:

```bash
# Detach branches and delete the source app (irreversible)
aws amplify delete-branch \
  --profile account-a --region us-east-1 \
  --app-id <SOURCE_APP_ID> --branch-name main

aws amplify delete-app \
  --profile account-a --region us-east-1 \
  --app-id <SOURCE_APP_ID>
```

## When NOT to use the zip deployment path

- The frontend lives in a multi-package repo and CI already publishes to a git remote: connect the new Amplify app to that remote and let Amplify build it. Skip steps 4-5.
- The build needs Amplify-managed environment variables that ship secrets you don't want in CI logs: connect the repo and use `update-branch --environment-variables` for the secret values.
- The team is large enough that "anyone with CI access can trigger a deploy" is a footgun: prefer the git-connected flow with branch-protection on `main`.
