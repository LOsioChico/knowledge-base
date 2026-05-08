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
  - "[[aws/recipes/ec2-snapshot-all-instances]]"
  - "[[aws/recipes/ec2-ami-cross-account-copy]]"
  - "[[aws/recipes/s3-presigned-urls]]"
  - "[[aws/recipes/s3-lifecycle-rules]]"
  - "[[aws/recipes/s3-event-notifications]]"
  - "[[aws/recipes/s3-static-website]]"
---

> Cross-cutting AWS recipes that span more than one service or that don't belong inside a single service note. The per-service "what is X / how does X work" framing lives one level up at [[aws/index|aws/index]]; runnable end-to-end procedures live here.

## Recipes

- [[aws/s3|S3]] / [[aws/recipes/cross-account-bucket-migration|cross-account bucket migration]]: replicate bucket configuration (policy, encryption, versioning, public-access block) and `aws s3 sync` the contents into a new account.
- [[aws/iam|IAM]] / [[aws/recipes/cross-account-role-pattern|cross-account role pattern]]: trust-policy + permissions-policy shape that lets one account assume a role in another.
- [[aws/rds|RDS]] / [[aws/recipes/cross-account-snapshot|cross-account snapshot]]: re-encrypt under a customer-managed [[aws/kms|KMS]] key (CMK), share the snapshot, restore in the destination account.
- [[aws/cloudfront|CloudFront]] / [[aws/recipes/alternate-domain-claim|alternate-domain ghost claims]]: bypass `CNAMEAlreadyExists` when the alias is still held by a deleted distribution.
- [[aws/amplify|Amplify Hosting]] / [[aws/recipes/cross-account-app-migration|cross-account app migration]]: rebuild the app in the destination via the zip-deployment path, then reattach the custom domain.
- EC2 / [[aws/recipes/ec2-snapshot-all-instances|snapshot every EC2 instance with AMIs]]: one-shot AMI per running/stopped instance, tagged for batch restore or cleanup.
- EC2 / [[aws/recipes/ec2-ami-cross-account-copy|cross-account AMI copy]]: share the AMI + each underlying snapshot, then `copy-image` from the destination so it owns an independent AMI.
- [[aws/s3|S3]] / [[aws/recipes/s3-presigned-urls|presigned URLs]]: time-limited URLs for browser-direct download or upload without making the bucket public.
- [[aws/s3|S3]] / [[aws/recipes/s3-lifecycle-rules|lifecycle rules]]: per-bucket JSON rules to age objects through cheaper storage classes and expire failed multipart uploads + noncurrent versions.
- [[aws/s3|S3]] / [[aws/recipes/s3-event-notifications|event notifications]]: trigger SNS / SQS / [[aws/lambda|Lambda]] / EventBridge from object created/removed/restored/etc events.
- [[aws/s3|S3]] / [[aws/recipes/s3-static-website|static website hosting]]: serve a bucket as a public site, optionally fronted by [[aws/cloudfront|CloudFront]] for HTTPS.
