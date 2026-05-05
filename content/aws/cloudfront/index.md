---
title: CloudFront
aliases: [aws cloudfront, cdn]
tags: [type/moc, tech/aws, tech/cloudfront]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/cloudfront/alternate-domain-claim]]"
  - "[[aws/amplify/index]]"
---

Notes on Amazon CloudFront: distributions, alternate domain names (CNAMEs), and the gotchas where Amplify-managed flows hide direct CloudFront state from you.

## Notes

- [[aws/cloudfront/alternate-domain-claim|Alternate-domain ghost claims]]: deleting a distribution doesn't release its CNAME aliases right away; the bypass is presenting your own ACM certificate or moving the alias with `update-domain-association`.

## CLI cheat-sheet

```bash
# What distributions exist; who claims a given alias?
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items != null].{Id:Id,Domain:DomainName,Aliases:Aliases.Items}" \
  --output table

# Move an alias from one distribution to another (documented path)
aws cloudfront update-distribution --id <ID> --distribution-config file://config.json --if-match <ETAG>
```

For the Amplify-managed equivalent (`aws amplify list-domain-associations`, `get-domain-association`, `update-domain-association`), see [[aws/amplify/index|Amplify Hosting]].
