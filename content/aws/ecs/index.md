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
---

> Amazon ECS (Elastic Container Service) is AWS's container orchestrator: you define a **task** (one or more containers + their resources), AWS schedules it onto compute. **Fargate** is the serverless launch type: AWS provides the compute too, you just bring containers. **EC2** launch type means you run the cluster nodes yourself on [[aws/ec2/index|EC2]] instances.

This area is a placeholder.

## Pending notes

- Task definition vs Service vs Task: the three primitives and how they map to Kubernetes equivalents.
- Fargate vs EC2 launch type: cost, control, and operational trade-offs.
- Networking modes: `awsvpc` gives each task its own ENI; required for Fargate.
- Task IAM roles vs task execution roles: which one your container code uses vs what pulls the image.
- Rolling deploys, blue/green via CodeDeploy, and circuit-breaker rollback.

## See also

- [Amazon ECS developer guide](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html) (official).
