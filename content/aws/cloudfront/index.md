---
title: CloudFront
aliases: [aws cloudfront, amazon cloudfront, cdn]
tags: [type/concept, tech/aws, tech/cloudfront]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/cloudfront/cli]]"
  - "[[aws/cloudfront/alternate-domain-claim]]"
  - "[[aws/amplify/cross-account-migration]]"
  - "[[aws/amplify/index]]"
  - "[[aws/s3/index]]"
  - "[[aws/s3/static-website]]"
  - "[[aws/s3/presigned-urls]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html
  - https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html
---

> Amazon CloudFront is AWS's global CDN: you point a **distribution** at one or more **origins** (S3 bucket, Application Load Balancer, generic HTTPS endpoint, [[aws/amplify/index|Amplify]] app), attach a domain and a certificate, and CloudFront caches the response at **edge locations** (regional points of presence near end users) and serves it from the nearest one.

## TL;DR

- **Distribution = the CDN endpoint.** One distribution, one or more origins, one or more behaviors (path-pattern routing rules), one or more aliases.
- **Aliases (CNAMEs) are globally unique** across all AWS accounts. The same hostname can live on only one distribution at a time; collisions need eviction or a wildcard override ([source](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html)).
- **Default 24h TTL (time-to-live, the cached-object expiry)** plus a lookup key that defaults to just the path. Forwarded headers/cookies/query-strings each fragment the lookup, so adding `Authorization` to the key turns the CDN into a free origin proxy by accident.
- **ACM certificate must live in `us-east-1`** if you use any custom alias (regardless of where the origin lives).
- **Amplify hides its CloudFront distribution.** You won't see it in `cloudfront list-distributions`; you talk to it through `aws amplify`.

## When to use

- **Use CloudFront** for: static asset hosting (S3 + CloudFront is the canonical single-page-app (SPA) setup), TLS + custom domain in front of an ALB (Application Load Balancer), edge serving of API responses, geo-restricted distribution.
- **Don't use CloudFront** as a load balancer (it's an edge proxy, not a balancer; put an ALB underneath if you also need balancing).
- **Don't use CloudFront** for low-latency dynamic API responses with tight key constraints: each forwarded header/cookie/query-string fragments the lookup.

## Mental model

A **distribution** is the unit of "I have a CDN endpoint". Each distribution carries:

- **One or more origins**: the actual source of the bytes (S3, ALB, custom HTTPS, Amplify-managed origin).
- **A default behavior plus optional path-pattern behaviors**: what to keep at the edge, for how long, what headers/cookies/query-strings to forward, which origin to use.
- **Aliases (alternate domain names)**: the hostnames the distribution responds to. Plus the auto-generated `dXXX.cloudfront.net` hostname that always works.
- **An ACM certificate in `us-east-1`**: required for any non-default alias.

## Pending notes

- Default 24h TTL and the lookup-key trap (forwarded headers/cookies/query-strings fragment the lookup).
- Alternate domain names are globally unique across all AWS accounts; the eviction options.
- Amplify hides its CloudFront distribution; you talk to it through `aws amplify` instead.

## See also

- [[aws/cloudfront/cli|CloudFront CLI cheatsheet]]: distribution lookup, invalidation, alias inspection.
- [[aws/cloudfront/alternate-domain-claim|Alternate-domain ghost claims]]: evict a stuck alias.
- [[aws/amplify/index|Amplify Hosting]]: the managed CloudFront-under-the-hood story.
- [Amazon CloudFront developer guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html) (official).
