---
title: ECS and Fargate
aliases: [aws ecs, elastic container service, fargate, aws fargate]
tags: [type/concept, tech/aws, tech/ecs]
area: aws
status: seed
related:
  - "[[aws/index]]"
  - "[[aws/ec2/index]]"
  - "[[aws/vpc/index]]"
  - "[[aws/iam/index]]"
source:
  - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html
  - https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-networking-awsvpc.html
  - https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policies.html
---

> Amazon ECS (Elastic Container Service) is AWS's container orchestrator: you define a **task** (one or more containers + their resources), AWS schedules it onto compute. **Fargate** is the serverless launch type: AWS provides the compute too, you just bring containers. **EC2** launch type means you run the cluster nodes yourself on [[aws/ec2/index|EC2]] instances.

## TL;DR

- **Task definition = pod-equivalent** (the Kubernetes pod is the smallest deployable unit: one or more containers scheduled together). JSON spec listing containers, ports, env vars, [[aws/iam/index|IAM]] role, CPU/memory. Versioned: each revision is immutable.
- **Service** runs N copies of a task and keeps that count alive (similar to a Kubernetes Deployment). Optionally registers tasks with a load balancer.
- **Two launch types**. **Fargate**: pay per task vCPU (virtual CPU)/memory-second, no nodes to manage. **EC2**: cheaper at scale but you patch and right-size the cluster nodes.
- **Networking via [[aws/vpc/index|VPC]]**. `awsvpc` mode gives each task its own ENI (Elastic Network Interface) with its own security group; required for Fargate ([source](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-networking-awsvpc.html)).
- **Image registry is ECR (Elastic Container Registry)** by default. Cross-account pull requires both an IAM policy on the puller and a repository policy on the registry ([source](https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-policies.html)).

## When to use

- **Use Fargate** for: most container workloads where the per-task cost is acceptable. Zero node management.
- **Use ECS on EC2** for: large fleets where Fargate's premium dominates, GPU workloads, or anything needing instance-level customization.
- **Don't use ECS** when you already need full Kubernetes (multi-cluster federation, custom controllers, Helm charts); use EKS (Elastic Kubernetes Service, AWS's managed Kubernetes) instead.
- **Don't use ECS** for ad-hoc compute that scales to zero (use [[aws/lambda/index|Lambda]], or App Runner, the AWS service that runs a container from a git push or image URI without you provisioning anything).

## Pending notes

- Task IAM roles vs task execution roles: which one your container code uses vs what pulls the image.
- Rolling deploys, blue/green via CodeDeploy, and circuit-breaker rollback.
- Service auto-scaling: target-tracking on CPU/memory vs request-count-per-task.

## See also

- [Amazon ECS developer guide](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html) (official).
