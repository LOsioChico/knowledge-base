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

This area is a placeholder. Day-to-day commands live in [[aws/amplify/cli|Amplify CLI cheatsheet]]; the cross-account move is at [[aws/amplify/cross-account-migration|cross-account Amplify app migration]].

## Pending notes

- App / Branch / Deployment / Domain primitives.
- Git-connected vs manual zip deployment; when each is appropriate.
- Domain associations leak CloudFront alias claims: tie-in to [[aws/cloudfront/alternate-domain-claim|alternate-domain ghost claims]].
- Amplify Gen 2 (the code-first successor to the original Amplify CLI) for full-stack deployments.

## See also

- [[aws/amplify/cli|Amplify CLI cheatsheet]]: app/branch/deployment/domain commands.
- [[aws/amplify/cross-account-migration|Cross-account Amplify app migration]]: recreate an Amplify app in a new account via the zip-deployment path.
- [[aws/cloudfront/alternate-domain-claim|Alternate-domain ghost claims]]: the CloudFront-side gotcha that bites every Amplify domain move.
- [Amplify Hosting user guide](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html) (official).
