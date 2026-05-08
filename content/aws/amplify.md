---
title: Amplify Hosting
aliases: [aws amplify, amplify hosting]
tags: [type/concept, tech/aws, tech/amplify]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/cli/amplify-cheatsheet]]"
  - "[[aws/recipes/cross-account-app-migration]]"
  - "[[aws/cloudfront]]"
  - "[[aws/lambda]]"
  - "[[aws/recipes/alternate-domain-claim]]"
  - "[[aws/cli/cloudfront-cheatsheet]]"
  - "[[aws/recipes/s3-static-website]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html
---

> AWS Amplify Hosting is the "git push to deploy a frontend" managed service: you connect a repo (or upload a zip), Amplify builds it, ships it to an internally-managed [[aws/cloudfront|CloudFront]] distribution, and serves it under a default `*.amplifyapp.com` hostname or a custom domain. The whole thing is one CLI surface (`aws amplify`) wrapping app, branch, deployment, and domain primitives.

## Mental model

```
App (one per project)
└── Branch (one per git branch you want deployed: main, staging, etc.)
    └── Deployment / Job (one per build, manual zip upload, or git push)
        └── Domain association (custom hostnames + which branch each subdomain maps to)
```

The four primitives:

| Primitive              | What it is                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **App**                | Top-level container. Has a name, a platform (`WEB`, `WEB_COMPUTE` for server-side rendering, SSR), build settings, env vars, custom rewrite rules.                             |
| **Branch**             | Per-environment config: which git branch to track (or no git, for zip-only), which env vars, which stage (`PRODUCTION`/`STAGING`/`DEVELOPMENT`/`PULL_REQUEST`/`EXPERIMENTAL`). |
| **Deployment / Job**   | One build. `JobType` is `RELEASE` (git push), `RETRY`, `MANUAL` (zip upload), or `WEB_HOOK`.                                                                                   |
| **Domain association** | Custom hostnames mapped to branches (`app.example.com` → `main`, `staging.example.com` → `staging`).                                                                           |

The hosting layer underneath is CloudFront: every Amplify app gets a CloudFront distribution that you don't see in `cloudfront list-distributions` from your account. You manage it through `aws amplify` instead. See [[aws/cloudfront|CloudFront]] for what's actually serving the bytes.

## Two ways to ship a build

1. **Git-connected** (the default). Connect a GitHub/GitLab/Bitbucket/CodeCommit repo and Amplify auto-builds on push. Build environment is defined by `amplify.yml` (or the inline build spec). Trigger manually with `start-job --job-type RELEASE`.
2. **Manual zip deployment** (no git connection). `create-deployment` returns a presigned `zipUploadUrl`; you `curl --upload-file your-build.zip "$URL"` and then `start-deployment` with the returned `jobId`. Useful when CI is external or when migrating an app and the source's git connection uses a token tied to a person who's leaving.

The zip path is what makes Amplify migrations reproducible: every step is a CLI call, no console clicks. Full sequence in [[aws/recipes/cross-account-app-migration|cross-account Amplify app migration]].

## Custom domains

Amplify owns the ACM certificate, the CloudFront distribution, the alias claim, and the Route53 (AWS's managed DNS service) records (if your domain is in Route53). When you call `create-domain-association`, Amplify provisions an ACM cert in `us-east-1`, attaches it to the underlying CloudFront distribution, and sets the alias.

> [!warning] Domain associations leak CloudFront alias claims
> Deleting an Amplify app does not always release the underlying CloudFront alternate-domain-name claim. The next attempt to attach the same hostname (in any account) can fail with `CNAMEAlreadyExists` even though there's no visible distribution holding it. The bypass is the [[aws/recipes/alternate-domain-claim|alternate-domain ghost claims]] recipe.

## When to use Amplify Hosting vs. something else

- **Use Amplify Hosting** for: single-page app (SPA) frontends with a build step, Next.js SSR (the `WEB_COMPUTE` platform), preview deployments per PR, when "git push to deploy" is the entire requirement.
- **Don't use Amplify Hosting** when you want explicit control over the CloudFront distribution (custom CDN behaviors, multiple origins, [[aws/lambda|Lambda]]@Edge: Lambda functions that run at CloudFront edge locations): use S3 + CloudFront directly.
- **Don't use Amplify Hosting** as your only compute layer for arbitrary backend services. Amplify Hosting itself ships full-stack and Amplify Gen 2 (the code-first successor to the original Amplify CLI) lets you co-deploy data/auth/storage from the same project ([source](https://docs.aws.amazon.com/amplify/latest/userguide/deploy-backend.html)); when those managed primitives don't fit (long-running workers, custom containers, non-Node runtimes), provision compute on [[aws/lambda|Lambda]], ECS, or App Runner (the managed-container service for source-to-URL deployments) instead.

## See also

- [[aws/cli/amplify-cheatsheet|Amplify CLI cheatsheet]]: app/branch/deployment/domain commands.
- [[aws/recipes/cross-account-app-migration|Cross-account Amplify app migration]]: recreate an Amplify app in a new account via the zip-deployment path.
- [[aws/recipes/alternate-domain-claim|Alternate-domain ghost claims]]: the CloudFront-side gotcha that bites every Amplify domain move.
- [Amplify Hosting user guide](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html) (official).
