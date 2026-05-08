---
title: EC2
aliases: [aws ec2, elastic compute cloud]
tags: [type/concept, tech/aws, tech/ec2]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/vpc/index]]"
  - "[[aws/ecs/index]]"
  - "[[aws/ec2/snapshot-all-instances]]"
  - "[[aws/ec2/ami-cross-account-copy]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html
---

> Amazon EC2 (Elastic Compute Cloud) is the rent-a-VM primitive: you pick an AMI (Amazon Machine Image, the boot disk), an instance type (vCPU + memory), a network ([[aws/vpc/index|VPC]] + subnet + security group), a key pair, and AWS hands you back a running Linux/Windows machine you can SSH into.

This area is a placeholder. The backup recipe is [[aws/ec2/snapshot-all-instances|snapshot every instance]]; the cross-account move is [[aws/ec2/ami-cross-account-copy|cross-account AMI copy]].

## Pending notes

- VPC + subnet + security-group bring-up: minimum viable network for a single instance.
- AMI vs raw EBS snapshot: when each is the right backup primitive.
- Spot vs On-Demand vs Savings Plan: when each saves money vs costs reliability.
- Instance Metadata Service v2 (IMDSv2): why v1 was a SSRF vector and how to enforce v2.

## See also

- [[aws/ec2/snapshot-all-instances|Snapshot every EC2 instance]]: one AMI per instance for ad-hoc backup.
- [[aws/ec2/ami-cross-account-copy|Cross-account AMI copy]]: move an AMI between accounts so the destination owns it.
- [Amazon EC2 user guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html) (official).
