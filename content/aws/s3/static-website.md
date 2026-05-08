---
title: S3 static website hosting
aliases: [s3 website, static site on s3, s3 web hosting, website endpoint]
tags: [type/recipe, tech/aws, tech/s3]
area: aws
status: evergreen
related:
  - "[[aws/s3/index]]"
  - "[[aws/cloudfront/index]]"
  - "[[aws/amplify/index]]"
  - "[[aws/recipes/index]]"
source:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html
---

> S3 can serve a bucket's objects as a public website at a Region-specific URL. It's the cheapest way to host an HTML/CSS/JS site, but the bare S3 endpoint is HTTP-only: for HTTPS or a custom domain, front it with [[aws/cloudfront/index|CloudFront]] or use [[aws/amplify/index|Amplify Hosting]].

## When to reach for it

- **Use bare S3 website hosting** for ephemeral, internal, or test sites where HTTPS doesn't matter and you control the URL contract (you'll be linking the `s3-website` URL directly).
- **Use S3 + CloudFront + ACM** for any production-facing static site: gives you HTTPS (via an ACM (AWS Certificate Manager) cert), a custom domain, and edge delivery (the response is served from a CloudFront point-of-presence near the user, not from the bucket's Region).
- **Use [[aws/amplify/index|Amplify Hosting]]** when you want all of the above without managing CloudFront yourself. It's AWS's official recommendation for new static sites ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html#WebsiteHosting)).

## Enable hosting on a bucket

Two pieces of config: the website setting and the public-read bucket policy.

```bash
# 1. Turn off Block Public Access on the bucket (the website needs anonymous reads)
aws s3api put-public-access-block \
  --bucket my-site \
  --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false

# 2. Enable website hosting with index + error documents
aws s3 website s3://my-site/ \
  --index-document index.html \
  --error-document error.html

# 3. Attach a bucket policy that allows public GetObject
aws s3api put-bucket-policy --bucket my-site --policy file://policy.json
```

`policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-site/*"
    }
  ]
}
```

The bucket is now reachable at:

```
http://my-site.s3-website-us-east-1.amazonaws.com   (older "dash-Region" format)
http://my-site.s3-website.us-west-2.amazonaws.com   (newer "dot-Region" format)
```

Which format applies depends on the Region; AWS publishes the [full list](https://docs.aws.amazon.com/general/latest/gr/s3.html#s3_website_region_endpoints) ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html)).

## Website endpoint vs REST endpoint

The website endpoint (`s3-website-...`) and the REST endpoint (`s3.amazonaws.com`) are **two different URLs to the same bytes** with very different behavior:

| Behavior           | REST endpoint                      | Website endpoint                        |
| ------------------ | ---------------------------------- | --------------------------------------- |
| HTTPS              | Yes                                | **No** (HTTP only)                      |
| Methods            | Full S3 API (PUT, DELETE, LIST, …) | GET and HEAD only                       |
| Errors             | XML response                       | HTML document (your `error.html`)       |
| GET on bucket root | Returns object list (XML)          | Returns the configured `index.html`     |
| Access             | Public or private                  | **Public only**                         |
| Redirects          | Not supported                      | Object-level and bucket-level supported |

When you build a static site, you want the **website** endpoint. The REST endpoint will return raw XML object listings and won't honor your index document.

## The HTTPS gap

> [!warning] The S3 website endpoint is HTTP-only: there is no HTTPS option
> The cert for `*.s3-website-<region>.amazonaws.com` doesn't exist. If you need HTTPS (and you do, for any site shown to a real user), you front the bucket with **CloudFront** + an ACM certificate, or use **Amplify Hosting**, which sets that up for you ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteEndpoints.html)). When you do that, configure CloudFront's origin to be the **website endpoint** (not the REST endpoint), so index documents and error documents continue to work.

## Custom domain via CNAME

To use `www.example.com`:

1. Create a bucket named **exactly** `www.example.com`. The bucket name must match the hostname so the request routes via S3's _virtual-host-style addressing_, where the bucket name is taken from the URL hostname rather than the path.
2. Enable website hosting + public-read policy as above.
3. Add a DNS CNAME from `www.example.com` to `www.example.com.s3-website.<region>.amazonaws.com`.

For the apex (`example.com`), CNAMEs aren't allowed by DNS spec: use Route 53 (AWS's managed DNS service) alias records instead, which can target the S3 website endpoint directly.

## Index and error documents

- `index-document` (e.g., `index.html`) is served when the request hits a "directory" path (`/`, `/blog/`). S3 also serves it for paths that resolve to a prefix.
- `error-document` (e.g., `404.html`) is served on any 4xx response. Single-page apps (SPAs) typically point this at `index.html` so the client-side router handles unknown paths: works, but the HTTP response status is still `404`, which can confuse search-engine optimization (SEO) crawlers and analytics. If you front the bucket with [[aws/cloudfront/index|CloudFront]], its _custom error responses_ feature can rewrite the status to `200` on the way out.

## Page-level redirects

Two ways to redirect:

1. **Per-object redirect**: set the `x-amz-website-redirect-location` metadata on a single object. A GET to that key returns a 301 to the configured URL.
2. **Bucket-level routing rules**: a JSON ruleset attached to the website config that matches request key prefixes / HTTP error codes and rewrites the response (redirect, replace prefix, etc.). Only available on the website endpoint, not REST.

Useful for migrating URLs: dump all old paths as zero-byte objects with a redirect header pointing at their new location.

## Costs

Same as normal S3: storage + request costs + egress. There is no extra fee for enabling website hosting. If you front with CloudFront, the egress cost shifts to CloudFront's per-Region pricing, which is often cheaper at scale and avoids cross-Region S3 egress.

## See also

- [[aws/s3/index|S3]] (parent concept).
- [[aws/cloudfront/index|CloudFront]] (the HTTPS + CDN front-end).
- [[aws/amplify/index|Amplify Hosting]] (the recommended one-step alternative).
- [Tutorial: configuring a static website using a custom domain registered with Route 53](https://docs.aws.amazon.com/AmazonS3/latest/userguide/website-hosting-custom-domain-walkthrough.html) (official end-to-end walkthrough).
