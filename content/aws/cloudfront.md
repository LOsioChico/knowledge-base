---
title: CloudFront
aliases: [aws cloudfront, amazon cloudfront, cdn]
tags: [type/concept, tech/aws, tech/cloudfront]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/cli/cloudfront-cheatsheet]]"
  - "[[aws/recipes/alternate-domain-claim]]"
  - "[[aws/recipes/cross-account-app-migration]]"
  - "[[aws/amplify]]"
  - "[[aws/s3]]"
source:
  - https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html
  - https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html
---

> Amazon CloudFront is AWS's global CDN: you point a **distribution** at one or more **origins** (S3 bucket, Application Load Balancer, generic HTTPS endpoint, [[aws/amplify|Amplify]] app), attach a domain and a certificate, and CloudFront caches and serves the response from the nearest edge location.

## Mental model

A **distribution** is the unit of "I have a CDN endpoint". Each distribution has:

- **One or more origins**: the actual source of the bytes (S3, ALB, custom HTTPS, Amplify-managed origin).
- **A default edge behavior plus optional path-pattern behaviors**: what to keep at the edge, for how long, what headers/cookies/query-strings to forward, which origin to use.
- **Aliases (CNAMEs / "alternate domain names")**: the hostnames the distribution responds to (e.g. `app.example.com`). The distribution also gets an auto-generated `dXXX.cloudfront.net` hostname that always works.
- **An ACM certificate in `us-east-1`**: required if you use any alias other than the default cloudfront.net domain. CloudFront only consumes certificates from N. Virginia, regardless of where the origin lives.

## How CloudFront caches

Defaults to know:

- Default TTL is 24h. Most teams discover this when a deploy looks fine in `curl` against the origin but stale in the browser. Either set the TTL low and rely on origin `Cache-Control`, or invalidate explicitly after each deploy (`aws cloudfront create-invalidation --paths '/*'` is the lazy nuke).
- The lookup key by default is just the path. Forwarded headers, cookies, and query strings are opt-in and each one fragments the lookup. Adding `Authorization` to the key is what turns a CDN into "free origin proxy" by accident.
- `Cache-Control: no-store` from the origin is honored. `no-cache` is honored too but means "revalidate", not "skip the edge": a common source of unexpected origin load.

## Alternate domain names are globally unique

A given hostname (e.g. `app.example.com`) can be attached as an alias to **only one CloudFront distribution at a time, across all AWS accounts** ([source](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html#alternate-domain-names-restrictions)). To "take" an alias from another distribution, you either:

1. Use `update-distribution` on the source side to remove the alias (only works if you control both accounts), or
2. Present an ACM certificate that proves you own the domain: CloudFront will then let your new distribution claim the alias even if the source distribution still has it. This is the documented "ownership protection" path.

The bypass matters because in practice the source distribution is often unreachable: deleted, in someone else's account, or hidden behind Amplify's managed flow. The full triage is in [[aws/recipes/alternate-domain-claim|alternate-domain ghost claims]].

> [!warning] Amplify hides the CloudFront distribution
> Amplify Hosting provisions and manages a CloudFront distribution under the covers. You won't see it in `cloudfront list-distributions` from the same account; you talk to it through `aws amplify` commands. When migrating an Amplify app between accounts, you're really migrating "Amplify's domain association" plus the underlying CloudFront alias: see [[aws/recipes/cross-account-app-migration|cross-account Amplify app migration]].

## When to use CloudFront vs. something else

- **Use CloudFront** for: static asset hosting (S3 + CloudFront is the canonical SPA setup), serving API responses at the edge, custom domain + TLS in front of an ALB, geo-restricted distribution.
- **Don't use CloudFront** as a load balancer: it's an edge proxy, not a balancer. Put an ALB in front of your origins; put CloudFront in front of the ALB if you also need edge serving.
- **Don't use CloudFront** for low-latency dynamic API responses with tight key constraints: each forwarded header/cookie/query-string fragments the lookup.

## See also

- [[aws/cli/cloudfront-cheatsheet|CloudFront CLI cheatsheet]]: distribution lookup, invalidation, alias inspection.
- [[aws/recipes/alternate-domain-claim|Alternate-domain ghost claims]]: how to evict a stuck alias.
- [[aws/amplify|Amplify Hosting]]: the managed CloudFront-under-the-hood story.
- [Amazon CloudFront developer guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html) (official).
