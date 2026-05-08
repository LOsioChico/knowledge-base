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
---

> Amazon CloudFront is AWS's global CDN: you point a **distribution** at one or more **origins** (S3 bucket, Application Load Balancer, generic HTTPS endpoint, [[aws/amplify/index|Amplify]] app), attach a domain and a certificate, and CloudFront holds the response in edge locations and serves it from the nearest one.

This area is a placeholder. Day-to-day commands live in [[aws/cloudfront/cli|CloudFront CLI cheatsheet]]; the alias-collision recipe is at [[aws/cloudfront/alternate-domain-claim|alternate-domain ghost claims]].

## Pending notes

- Distribution + origin + behavior + alias model; ACM certificate must live in `us-east-1`.
- Default 24h TTL and the lookup-key trap (forwarded headers/cookies/query-strings fragment the lookup).
- Alternate domain names are globally unique across all AWS accounts; the eviction options.
- Amplify hides its CloudFront distribution; you talk to it through `aws amplify` instead.

## See also

- [[aws/cloudfront/cli|CloudFront CLI cheatsheet]]: distribution lookup, invalidation, alias inspection.
- [[aws/cloudfront/alternate-domain-claim|Alternate-domain ghost claims]]: evict a stuck alias.
- [[aws/amplify/index|Amplify Hosting]]: the managed CloudFront-under-the-hood story.
- [Amazon CloudFront developer guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html) (official).
