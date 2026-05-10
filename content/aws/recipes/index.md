---
title: AWS recipes
aliases: [aws recipes, aws how-tos]
tags: [type/moc, tech/aws]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/recipes/cross-account-role-pattern]]"
---

> Cross-cutting AWS recipes that span more than one service or that don't belong inside a single service note. Per-service recipes live with their service: see each `aws/<service>/` folder for service-specific how-tos.

## Cross-cutting recipes

- [[aws/recipes/cross-account-role-pattern|Cross-account IAM role pattern]]: trust-policy (names who may assume the role) + permissions-policy (names what the role may do) shape that lets one account assume a role in another. Underlies every other cross-account recipe.

## Per-service recipes (live in their service folder)

- [[aws/s3/cross-account-migration|S3 cross-account migration]]
- [[aws/rds/cross-account-snapshot|RDS cross-account snapshot]]
- [[aws/cloudfront/alternate-domain-claim|CloudFront alternate-domain ghost claims]]
- [[aws/amplify/cross-account-migration|Amplify cross-account app migration]]
- [[aws/ec2/snapshot-all-instances|EC2 snapshot every instance with AMIs]]
- [[aws/ec2/ami-cross-account-copy|EC2 cross-account AMI copy]]
