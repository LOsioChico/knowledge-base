---
title: EC2
aliases: [aws ec2, elastic compute cloud]
tags: [type/concept, tech/aws, tech/ec2]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/lambda-vs-ec2]]"
  - "[[aws/vpc/index]]"
  - "[[aws/ecs/index]]"
  - "[[aws/ec2/snapshot-all-instances]]"
  - "[[aws/ec2/ami-cross-account-copy]]"
  - "[[aws/account-migrations]]"
source:
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/CopyingAMIs.html
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html
---

> Amazon EC2 (Elastic Compute Cloud) is the rent-a-VM primitive: you pick an AMI (Amazon Machine Image, the boot disk), an instance type (vCPU + memory), a network ([[aws/vpc/index|VPC]] + subnet + security group), a key pair, and AWS hands you back a running Linux/Windows machine you can SSH into.

## TL;DR

- **Instance = a VM**. Identified by an instance ID; lives in one Availability Zone (AZ, an isolated datacenter within a Region); owns one or more EBS (Elastic Block Store) volumes for storage.
- **AMI = the boot disk template**. Same AMI in another Region requires [`copy-image`](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/CopyingAMIs.html); same AMI in another account requires sharing both the image and its underlying snapshots ([[aws/ec2/ami-cross-account-copy|cross-account AMI copy]]).
- **Whole-machine backups are AMIs, not raw EBS snapshots**. An AMI captures the root volume + boot config + every attached EBS volume so the machine is redeployable from one ID. Recipe: [[aws/ec2/snapshot-all-instances|snapshot every EC2 instance]].
- **Networking lives in the VPC**. Security groups gate traffic; key pairs gate SSH; an [Elastic IP](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html) keeps the public address sticky across stop/start (otherwise the public IP changes).
- **Pricing is per-second** for most instance families, with Reserved (a 1- or 3-year capacity commitment in exchange for a steep discount) and Spot (deeply-discounted unused-capacity instances that AWS can reclaim with two minutes' notice) pricing for sustained or interruptible workloads.

## When to use

- **Use EC2** when you need a long-running VM, a custom kernel, GPU access, a non-Lambda runtime, or to lift-and-shift an existing on-prem server.
- **Don't use EC2** for stateless request handlers ([[aws/lambda/index|Lambda]] or container runtimes scale better) or for managed databases (use [[aws/rds/index|RDS]]).

## Pending notes

- VPC + subnet + security-group bring-up: minimum viable network for a single instance.
- AMI vs raw EBS snapshot: when each is the right backup primitive.
- Spot vs On-Demand vs Savings Plan: when each saves money vs costs reliability.
- Instance Metadata Service v2 (IMDSv2): why v1 was a SSRF vector and how to enforce v2.

## See also

- [[aws/ec2/snapshot-all-instances|Snapshot every EC2 instance]]: one AMI per instance for ad-hoc backup.
- [[aws/ec2/ami-cross-account-copy|Cross-account AMI copy]]: move an AMI between accounts so the destination owns it.
- [Amazon EC2 user guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/concepts.html) (official).
