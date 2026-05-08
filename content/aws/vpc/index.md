---
title: VPC
aliases: [aws vpc, virtual private cloud]
tags: [type/concept, tech/aws, tech/vpc]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/ec2/index]]"
  - "[[aws/rds/index]]"
source:
  - https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html
---

> Amazon VPC (Virtual Private Cloud) is your private slice of the AWS network: an isolated IPv4/IPv6 address space, carved into **subnets** per Availability Zone, with route tables, security groups, and gateways that decide what can reach in or out. Every regional resource ([[aws/ec2/index|EC2]], [[aws/rds/index|RDS]], Lambda-in-VPC, ECS task) lives in one.

This area is a placeholder. There's no CLI cheatsheet yet because most VPC work is tied to whatever lives inside the VPC; commands surface in the per-service cheatsheets.

## Pending notes

- CIDR planning: pick once, can't shrink later; secondary CIDRs as the escape hatch.
- Public/private subnet pattern with NAT Gateway: minimum viable two-tier setup.
- Security groups (stateful, instance-level) vs network ACLs (stateless, subnet-level): which to reach for.
- VPC endpoints (gateway vs interface): when each saves money vs adds latency.
- VPC peering vs Transit Gateway vs PrivateLink: routing choices when you need cross-VPC traffic.

## See also

- [[aws/ec2/index|EC2]]: instances live in subnets; security groups gate traffic to them.
- [Amazon VPC user guide](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html) (official).
