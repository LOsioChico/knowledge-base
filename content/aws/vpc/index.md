---
title: VPC
aliases: [aws vpc, virtual private cloud]
tags: [type/concept, tech/aws, tech/vpc]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/lambda-vs-ec2]]"
  - "[[aws/ec2/index]]"
  - "[[aws/rds/index]]"
source:
  - https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html
---

> Amazon VPC (Virtual Private Cloud) is your private slice of the AWS network: an isolated IPv4/IPv6 address space, carved into **subnets** per Availability Zone, with route tables, security groups, and gateways that decide what can reach in or out. Every regional resource ([[aws/ec2/index|EC2]], [[aws/rds/index|RDS]], [[aws/lambda/index|Lambda]] running inside a VPC, ECS task) lives in one.

## TL;DR

- **CIDR block (Classless Inter-Domain Routing notation, the `address/prefix-length` form like `10.0.0.0/16` that names an IP range) at creation, immutable shape**. Pick the IP range up front (e.g. `10.0.0.0/16`); you can add secondary CIDRs later but cannot shrink the primary.
- **Subnet = AZ + CIDR slice**. **Public subnet** has a route to an Internet Gateway; **private subnet** does not (egress goes through a NAT (Network Address Translation) Gateway, which costs ~$0.045/hour + per-GB).
- **Security group = stateful firewall** at the instance level. **Network ACL = stateless** at the subnet level. SGs are the workhorse; NACLs are for blanket subnet-wide rules.
- **VPC endpoints** let resources in private subnets reach AWS services (S3, DynamoDB, SQS, etc.) without going through the internet: saves NAT cost and bandwidth.
- **Default VPC** in every Region works out of the box but is too permissive for production. Build your own.

## When to use

- **Use a custom VPC** for: any production workload, anything with private databases, anything subject to compliance.
- **Use the default VPC** for: throwaway sandboxes, single-instance experiments, learning.
- **Don't use multiple unconnected VPCs** when one would do: VPC peering and Transit Gateway add cost and complexity.

## Pending notes

- CIDR planning: pick once, can't shrink later; secondary CIDRs as the escape hatch.
- Public/private subnet pattern with NAT Gateway: minimum viable two-tier setup.
- Security groups (stateful, instance-level) vs network ACLs (stateless, subnet-level): which to reach for.
- VPC endpoints (gateway vs interface): when each saves money vs adds latency.
- VPC peering vs Transit Gateway vs PrivateLink: routing choices when you need cross-VPC traffic.

## See also

- [[aws/ec2/index|EC2]]: instances live in subnets; security groups gate traffic to them.
- [Amazon VPC user guide](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html) (official).
