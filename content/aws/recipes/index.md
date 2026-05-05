---
title: AWS recipes
aliases: [aws recipes, aws how-tos]
tags: [type/moc, tech/aws]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/recipes/cross-account-bucket-migration]]"
---

> Cross-cutting AWS recipes that span more than one service or that don't belong inside a single service note. The per-service "what is X / how does X work" framing lives one level up at [[aws/index|aws/index]]; runnable end-to-end procedures live here.

## Recipes

- [[aws/recipes/cross-account-bucket-migration|Cross-account S3 bucket migration]]: replicate bucket configuration (policy, encryption, versioning, public-access block) and `aws s3 sync` the contents into a new account.
