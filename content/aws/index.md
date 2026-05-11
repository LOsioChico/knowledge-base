---
title: AWS
aliases: [aws notes, amazon web services]
tags: [type/moc, tech/aws]
area: aws
status: evergreen
related:
  - "[[index]]"
  - "[[aws/cli/index]]"
  - "[[aws/recipes/index]]"
  - "[[aws/iam/index]]"
  - "[[aws/rds/index]]"
  - "[[aws/cloudfront/index]]"
  - "[[aws/amplify/index]]"
  - "[[aws/s3/index]]"
  - "[[aws/kms/index]]"
  - "[[aws/lambda/index]]"
  - "[[aws/ec2/index]]"
  - "[[aws/dynamodb/index]]"
  - "[[aws/sqs/index]]"
  - "[[aws/sns/index]]"
  - "[[aws/vpc/index]]"
  - "[[aws/ecs/index]]"
  - "[[aws/lambda-vs-ec2]]"
  - "[[aws/account-migrations]]"
---

> Map of content for AWS. Each service lives in its own folder `aws/<service>/`: `index.md` is the concept note ("what is it, how does it work, when to use it"), `cli.md` is the CLI cheatsheet, and any service-specific deep-dives or recipes sit alongside. Cross-cutting recipes that touch more than one service live under [[aws/recipes/index|aws/recipes]]; CLI fundamentals (profiles, output shaping) live under [[aws/cli/index|aws/cli]].

## Start here

If you're new to AWS, read in this order:

1. [[aws/cli/index|AWS CLI]]: profiles, credentials, `--query`/`--output`. Required before any per-service walkthrough.
2. [[aws/iam/index|IAM]]: identities, policies, role-based access. Every other service depends on IAM.
3. [[aws/s3/quickstart|S3 quickstart]]: 10-minute hands-on with the simplest stateful primitive (object storage).
4. [[aws/recipes/cross-account-role-pattern|Cross-account role pattern]]: the trust policy (the role document naming who may call `sts:AssumeRole`) + `ExternalId` (the optional shared secret the trusting account requires on every assume call) pattern that recurs across services.

After that, jump to whichever service the task needs; the per-service indexes are scannable in any order.

## Foundations

- [[aws/cli/index|AWS CLI]]: profiles, credentials, `--query`, `--output`, JMESPath patterns (the JSON query language behind `--query`). Per-service cheatsheets live alongside (e.g. [[aws/s3/cli|S3 CLI cheatsheet]]).

## Services

- [[aws/s3/index|S3, the Simple Storage Service]]: object storage. Buckets, keys, read-after-write consistency (a fresh `PUT` is immediately visible to subsequent `GET`s), default privacy. Start with the [[aws/s3/quickstart|S3 quickstart]] for a 10-minute hands-on walkthrough; then dive into [[aws/s3/storage-classes|storage classes]], [[aws/s3/lifecycle-rules|lifecycle rules]], [[aws/s3/event-notifications|event notifications]], [[aws/s3/presigned-urls|presigned URLs]], [[aws/s3/static-website|static website hosting]], [[aws/s3/cross-account-migration|cross-account migration]], or the [[aws/s3/cli|S3 CLI cheatsheet]].
- [[aws/iam/index|IAM]]: identities, roles, policy evaluation, cross-account trust.
- [[aws/rds/index|RDS]] (Relational Database Service): managed relational databases. Snapshots, encryption, multi-AZ (replication across two Availability Zones for failover).
- [[aws/cloudfront/index|CloudFront]]: content delivery network (CDN). Distributions, alternate domain names, edge (point-of-presence) defaults.
- [[aws/amplify/index|Amplify Hosting]]: managed frontend hosting. Apps, branches, deployments, custom domains.
- [[aws/kms/index|KMS]]: encryption keys. Customer-managed vs AWS-managed, key policies, cross-account grants.
- [[aws/lambda/index|Lambda]]: functions, versions, aliases. (Seed.)
- [[aws/ec2/index|EC2]] (Elastic Compute Cloud): virtual machines. Instances, AMIs (Amazon Machine Images), EBS (Elastic Block Store) volumes, security groups. (Seed.)
- [[aws/vpc/index|VPC]] (Virtual Private Cloud): private network. Subnets, route tables, security groups, NAT (Network Address Translation) gateways. (Seed.)
- [[aws/dynamodb/index|DynamoDB]]: managed key-value + document database. Partition keys, GSIs (global secondary indexes), streams. (Seed.)
- [[aws/sqs/index|SQS]] (Simple Queue Service): managed message queue. Standard vs FIFO (first-in-first-out, the strict-ordering queue type), visibility timeout, DLQs (dead-letter queues). (Seed.)
- [[aws/sns/index|SNS]] (Simple Notification Service): managed pub/sub. Topics, fan-out, filter policies. (Seed.)
- [[aws/ecs/index|ECS and Fargate]]: container orchestration. Tasks, services, Fargate (serverless) vs EC2 launch type. (Seed.)

## Recipes

- [[aws/recipes/index|AWS recipes]]: cross-cutting procedures (currently the [[aws/recipes/cross-account-role-pattern|cross-account IAM role pattern]]). Per-service recipes live in their service folder (e.g. [[aws/s3/cross-account-migration|S3 cross-account migration]], [[aws/rds/cross-account-snapshot|RDS snapshot]], [[aws/ec2/snapshot-all-instances|EC2 AMI snapshot]]).

## Cross-cutting workflows

- [[aws/account-migrations|Account migrations]]: end-to-end migration playbook that stitches the per-service recipes (RDS, IAM, S3, Amplify, CloudFront, KMS) into a single ordered narrative.

## Decision guides

- [[aws/lambda-vs-ec2|Lambda vs EC2 vs Fargate]]: which compute primitive fits which workload shape, with a decision matrix and a concrete pricing-crossover example.

## When to read this area

- You're planning a multi-service migration between AWS accounts.
- A specific service is quarantined and you need to evacuate while leaving healthy services in place.
- A second AWS account is taking over an existing workload and you need to keep the same DNS, data, and permissions wiring.
