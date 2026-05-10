---
title: Amplify Hosting
aliases: [aws amplify, amplify hosting]
tags: [type/concept, tech/aws, tech/amplify]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/amplify/cli]]"
  - "[[aws/amplify/cross-account-migration]]"
  - "[[aws/cloudfront/index]]"
  - "[[aws/lambda/index]]"
  - "[[aws/cloudfront/alternate-domain-claim]]"
  - "[[aws/cloudfront/cli]]"
  - "[[aws/s3/static-website]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html
---

> AWS Amplify Hosting is the "git push to deploy a frontend" managed service: you connect a repo (or upload a zip), Amplify builds it, ships it to an internally-managed [[aws/cloudfront/index|CloudFront]] distribution, and serves it under a default `*.amplifyapp.com` hostname or a custom domain. The whole thing is one CLI surface (`aws amplify`) wrapping app, branch, deployment, and domain primitives.

## TL;DR

- **Four primitives**: App (project) → Branch (per-environment config) → Deployment / Job (one build) → Domain association (custom hostnames).
- **Two ways to ship**: git-connected (auto-build on push) or manual zip (`create-deployment` returns a presigned URL, you `curl --upload-file` then `start-deployment`).
- **Hosting underneath is CloudFront** + ACM in `us-east-1` + Route 53 records (AWS's managed DNS, if your domain is in Route 53). Amplify owns and hides all three.
- **Custom domain = `create-domain-association`**: provisions ACM cert, attaches it, sets the alias.
- **Amplify Gen 2** is the code-first successor to the original Amplify CLI; it co-deploys data/auth/storage from the same project.

## When to use

- **Use Amplify Hosting** for: single-page-app (SPA) frontends with a build step, Next.js server-side rendering (SSR, the `WEB_COMPUTE` platform), preview deployments per PR, when "git push to deploy" is the entire requirement.
- **Don't use Amplify Hosting** when you want explicit control over the CloudFront distribution (custom CDN behaviors, multiple origins, Lambda@Edge functions that run at CloudFront edge locations); use S3 + CloudFront directly.
- **Don't use Amplify Hosting** as your only compute layer for arbitrary backend services: provision compute on [[aws/lambda/index|Lambda]], ECS, or App Runner instead.

## Mental model

```
App (one per project)
└── Branch (one per git branch you want deployed: main, staging, etc.)
    └── Deployment / Job (one per build, manual zip upload, or git push)
        └── Domain association (custom hostnames + which branch each subdomain maps to)
```

| Primitive              | What it is                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **App**                | Top-level container. Has a name, a platform (`WEB`, `WEB_COMPUTE` for SSR), build settings, env vars, custom rewrite rules. |
| **Branch**             | Per-environment config: which git branch to track (or no git, for zip-only), which env vars, which stage.                   |
| **Deployment / Job**   | One build. `JobType` is `RELEASE` (git push), `RETRY`, `MANUAL` (zip upload), or `WEB_HOOK`.                                |
| **Domain association** | Custom hostnames mapped to branches (`app.example.com` → `main`, `staging.example.com` → `staging`).                        |

Underneath, Amplify provisions a CloudFront distribution that you don't see in `cloudfront list-distributions`. You manage it through `aws amplify` instead.

## Pending notes

- Git-connected vs manual zip deployment; when each is appropriate.
- Domain associations leak CloudFront alias claims: tie-in to [[aws/cloudfront/alternate-domain-claim|alternate-domain ghost claims]].
- Amplify Gen 2 for full-stack deployments.

## See also

- [[aws/amplify/cli|Amplify CLI cheatsheet]]: app/branch/deployment/domain commands.
- [[aws/amplify/cross-account-migration|Cross-account Amplify app migration]]: recreate an Amplify app in a new account via the zip-deployment path.
- [[aws/cloudfront/alternate-domain-claim|Alternate-domain ghost claims]]: the CloudFront-side gotcha that bites every Amplify domain move.
- [Amplify Hosting user guide](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html) (official).
