---
title: CloudFront alternate-domain ghost claims
aliases:
  [
    cloudfront cname conflict,
    alternate domain name conflict,
    amplify domain stuck,
    cloudfront ownership protection,
  ]
tags: [type/gotcha, tech/aws, tech/cloudfront, tech/amplify, tech/acm]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
source:
  - https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html#alternate-domain-names-restrictions
  - https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/alternate-domain-names-move-options.html
  - https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html
---

> CloudFront alternate domain names are globally unique across accounts; the documented way to take an alias from another distribution is `update-domain-association`, but if you can't reach that path (Amplify-managed flow, source unreachable) presenting your own ACM certificate is the empirical workaround.

CloudFront enforces global uniqueness on alternate domain names (CNAMEs): a given domain can be attached to only one distribution at a time, [even across AWS accounts](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html#alternate-domain-names-restrictions). The trap, especially with Amplify's managed flow, is that retrying a failed domain association can stack lingering claims faster than you can clear them.

## Symptom

You attempt to attach `app.example.com` to a CloudFront distribution (directly or via Amplify) and get:

```text
One or more aliases specified for the distribution includes an incorrectly
configured DNS record that points to another CloudFront distribution. You must
update the DNS record to correct the problem.
```

DNS is correct, you have nothing else claiming the alias today, and you still get the error. Each retry generates a NEW CloudFront target, so updating DNS to chase it is a losing race.

> [!warning] Why retries make it worse
> When an Amplify-managed certificate fails to validate in time, deleting and recreating the domain association provisions a brand-new CloudFront distribution. The previous distribution may be gone, but the alternate-domain claim is observably not released right away (community reports and AWS Support cases put it at hours, sometimes longer; AWS does not document the duration). Each retry stacks another ghost claim. Don't retry the same broken path; switch strategies instead.

## Root cause

Per the [CloudFront alternate-domain-name restrictions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html#alternate-domain-names-restrictions), "You cannot add an alternate domain name to a CloudFront distribution if the same alternate domain name already exists in another CloudFront distribution, even if your AWS account owns the other distribution." Adding requires a TLS certificate that covers the alias, which proves authorization to add the name, but it does not by itself remove the duplicate-name restriction.

The documented way to take a name from another distribution is to **move it** with [`update-domain-association`](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/alternate-domain-names-move-options.html) (or the wildcard-move trick when the source is in another account). If you have access to both distributions and can disable the source, that is the canonical path and you should prefer it over the workaround below.

## Workaround when the documented path is blocked

The Amplify managed-domain flow does not expose `update-domain-association`, and if a previous attempt left an orphaned distribution you may not be able to reach the source to disable it. Empirically, requesting your own public ACM certificate that covers the alias and attaching it to the new association lets the alias attach where vanilla retries kept failing. AWS does not document this as a sanctioned bypass, but it is what AWS Support routinely recommends for Amplify domain-stuck cases.

> [!info] If you have access to the old distribution
> Skip the workaround. Use [`update-domain-association`](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/alternate-domain-names-move-options.html) to move the alias, or open an AWS Support ticket if cross-account move-by-wildcard is not viable. The workaround below is for the case where neither is available.

## Workaround steps: bring your own ACM certificate

Empirically unblocks the case where retries against the same prefix keep failing. Resolution time depends on how fast ACM issues the cert (typically minutes after the verification CNAME is in DNS) plus the time the association takes to redeploy.

1. **Request a public ACM certificate** in the same region you'll use the distribution in (us-east-1 for Amplify and most edge services). Cover both apex and wildcard so future subdomains are free:

   ```bash
   aws acm request-certificate \
     --domain-name example.com \
     --subject-alternative-names '*.example.com' \
     --validation-method DNS
   ```

   See [Requesting a public certificate](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html).

2. **Add the DNS verification CNAME** returned by `acm describe-certificate` to your DNS provider. ACM polls every minute or so; certs typically issue in under five minutes once the record is live.

3. **Wait for `Status: ISSUED`** before proceeding.

4. **Tell the distribution to use the custom certificate.** For Amplify:

   ```bash
   aws amplify update-domain-association \
     --app-id <APP_ID> \
     --domain-name example.com \
     --certificate-settings type=CUSTOM,customCertificateArn=<CERT_ARN> \
     --sub-domain-settings prefix=app,branchName=main
   ```

   CloudFront sees the cert covers the alias, accepts the alternate-domain attachment, and the association moves through `UPDATING` → `AVAILABLE`.

## Cheaper paths that fail

| Path                                                                       | Why it fails                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Click "Retry" in the console                                               | Each retry spins up a new distribution with a new CloudFront target, leaving another ghost claim behind. The error returns. |
| Wait a few minutes between retries                                         | The ownership record is measured in hours, not minutes.                                                                     |
| Delete the failed association and recreate with the same prefix            | Same as Retry: another ghost.                                                                                               |
| Delete the failed association and recreate with a NEW prefix (e.g. `app2`) | Works, because the new prefix has no ghost claims. Only useful if the prefix doesn't matter to you.                         |

## Recovery without a custom cert

If you can't or won't manage your own cert, the only remaining option is **time**. Stop all retries. Wait at least 2-4 hours, often longer. Then attempt the original prefix once. If it still fails, open an AWS Support case to clear the stale alternate-domain claims (Basic support is free, response is typically next business day).

## Operational notes

- Custom certs in Amplify do not auto-renew through Amplify; ACM renews them automatically as long as the verification CNAME stays in DNS. Don't delete the verification record after issuance.
- A wildcard cert covers exactly one level (`*.example.com` covers `app.example.com` but not `api.app.example.com`). For nested levels, request additional SANs.
- The ghost-claim store also affects non-Amplify CloudFront usage (custom distributions, S3 hosting). The same ACM bypass applies.
