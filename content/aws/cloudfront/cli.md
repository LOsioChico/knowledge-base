---
title: CloudFront CLI cheatsheet
aliases: [aws cloudfront cli, cloudfront commands]
tags: [type/reference, tech/aws, tech/aws-cli, tech/cloudfront]
area: aws
status: evergreen
related:
  - "[[aws/cli/index]]"
  - "[[aws/amplify/cli]]"
  - "[[aws/cloudfront/index]]"
  - "[[aws/amplify/index]]"
  - "[[aws/recipes/alternate-domain-claim]]"
---

> Distribution discovery, invalidation, and alias inspection. Most [[aws/cloudfront/index|CloudFront]] work is "find which distribution serves this hostname" followed by either an invalidation or a config update.

## Find a distribution

```bash
# All distributions in the account, with their aliases
aws cloudfront list-distributions \
  --query 'DistributionList.Items[].{Id:Id,Domain:DomainName,Aliases:Aliases.Items,Status:Status}' \
  --output table

# Which distribution claims this hostname?
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items != null && contains(Aliases.Items, '<hostname>')].{Id:Id,Domain:DomainName}" \
  --output table

aws cloudfront get-distribution        --id <ID>
aws cloudfront get-distribution-config --id <ID>   # returns config + ETag for update
```

## Invalidate the CDN

```bash
# Nuke everything (lazy default for "deploy made it to S3, why isn't it live?")
aws cloudfront create-invalidation --distribution-id <ID> --paths '/*'

# Targeted
aws cloudfront create-invalidation --distribution-id <ID> --paths '/index.html' '/static/css/*'

aws cloudfront list-invalidations --distribution-id <ID>
aws cloudfront get-invalidation   --distribution-id <ID> --id <INVALIDATION_ID>
```

The first 1,000 paths invalidated per month are free; after that they bill per path. Wildcards count as one path.

## Update a distribution

`update-distribution` is read-modify-write with optimistic concurrency:

```bash
# 1. Fetch
aws cloudfront get-distribution-config --id <ID> > dist.json
ETAG=$(jq -r .ETag dist.json)
jq .DistributionConfig dist.json > dist-config.json

# 2. Edit dist-config.json (e.g. remove an alias from Aliases.Items)

# 3. Push back
aws cloudfront update-distribution \
  --id <ID> \
  --distribution-config file://dist-config.json \
  --if-match "$ETAG"
```

If `--if-match` doesn't match the current ETag, the update is rejected: refetch and retry.

## Tips

- For [[aws/amplify/index|Amplify]]-managed distributions you mostly work through `aws amplify` (see [[aws/amplify/cli|Amplify CLI cheatsheet]]); the underlying CloudFront distribution doesn't appear in `list-distributions` from your account.
- Alias conflicts across accounts are the #1 reason a domain move fails. Triage path is in [[aws/recipes/alternate-domain-claim|alternate-domain ghost claims]].
