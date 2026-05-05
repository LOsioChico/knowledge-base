---
title: AWS recipes
aliases: [aws recipes, aws how-tos]
tags: [type/moc, tech/aws]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/recipes/cross-account-bucket-migration]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
  - "[[aws/recipes/cross-account-snapshot]]"
  - "[[aws/recipes/alternate-domain-claim]]"
  - "[[aws/recipes/cross-account-app-migration]]"
---

> Cross-cutting AWS recipes that span more than one service or that don't belong inside a single service note. The per-service "what is X / how does X work" framing lives one level up at [[aws/index|aws/index]]; runnable end-to-end procedures live here.

## Recipes

- [[aws/s3|S3]] / [[aws/recipes/cross-account-bucket-migration|cross-account bucket migration]]: replicate bucket configuration (policy, encryption, versioning, public-access block) and `aws s3 sync` the contents into a new account.
- [[aws/iam|IAM]] / [[aws/recipes/cross-account-role-pattern|cross-account role pattern]]: trust-policy + permissions-policy shape that lets one account assume a role in another.
- [[aws/rds|RDS]] / [[aws/recipes/cross-account-snapshot|cross-account snapshot]]: re-encrypt under a customer-managed [[aws/kms|KMS]] key (CMK), share the snapshot, restore in the destination account.
- [[aws/cloudfront|CloudFront]] / [[aws/recipes/alternate-domain-claim|alternate-domain ghost claims]]: bypass `CNAMEAlreadyExists` when the alias is still held by a deleted distribution.
- [[aws/amplify|Amplify Hosting]] / [[aws/recipes/cross-account-app-migration|cross-account app migration]]: rebuild the app in the destination via the zip-deployment path, then reattach the custom domain.
