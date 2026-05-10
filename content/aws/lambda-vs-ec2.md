---
title: Lambda vs EC2 vs Fargate
aliases:
  - aws compute choice
  - lambda or ec2
  - lambda vs ec2
  - serverless vs vm
  - when to use lambda
  - when to use fargate
tags: [type/concept, tech/aws, tech/lambda, tech/ec2, tech/ecs]
area: aws
status: evergreen
related:
  - "[[aws/index]]"
  - "[[aws/lambda/index]]"
  - "[[aws/ec2/index]]"
  - "[[aws/ecs/index]]"
  - "[[aws/rds/index]]"
  - "[[aws/vpc/index]]"
  - "[[aws/s3/presigned-urls]]"
source:
  - https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
  - https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html
  - https://docs.aws.amazon.com/lambda/latest/dg/provisioned-concurrency.html
  - https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html
  - https://aws.amazon.com/lambda/pricing/
  - https://aws.amazon.com/ec2/pricing/on-demand/
  - https://aws.amazon.com/fargate/pricing/
---

> [[aws/lambda/index|Lambda]], [[aws/ec2/index|EC2]], and [[aws/ecs/index|Fargate]] solve different shapes of workload. Picking Lambda for a long-lived backend trades operational simplicity you don't get for cold-start latency, connection-pool overhead, and a per-request pricing curve that crosses an always-on instance well before "high traffic". The decision is workload shape, not "serverless good, servers bad".

## TL;DR

- **Lambda fits**: event-driven glue (S3 → resize, DynamoDB stream → notify), low-duty-cycle scheduled jobs, spiky webhooks, anything that genuinely scales to zero.
- **Fargate fits**: long-running containerized services where you want serverless ops without Lambda's request model. Pay per task vCPU-second; no node management.
- **EC2 fits**: sustained backends, persistent connections, GPU/custom kernels, lift-and-shift, predictable cost at high utilization, low-level control.
- **The pricing crossover**: at sustained ~50 req/s with 200 ms × 512 MB Lambda, an `m7g.medium` running 24/7 is roughly **8× cheaper** ([math below](#pricing-math-one-concrete-workload)). Add [RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html) for the Lambda side and the gap widens.
- **The Lambda-as-monolith failure mode**: cold starts, connection-pool exhaustion (forcing RDS Proxy), 15-minute hard timeout, no WebSockets on the function itself, and provisioned-concurrency / warming-cron hacks that cost real money to paper over architectural mismatch.

## Decision matrix

Pick by workload shape, not by "is serverless better". The three columns map to "how much do I want AWS to do for me, in exchange for how much per-request overhead":

| Dimension                    | Lambda                                                                                                                                                   | Fargate                                                                                                                       | EC2                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Compute unit                 | Function (handler + runtime)                                                                                                                             | Container task (one or more containers)                                                                                       | VM (instance)                                                               |
| Provisioning                 | None: AWS scales execution environments per-request                                                                                                      | None: AWS schedules tasks onto Fargate capacity                                                                               | You pick instance type, count, AZs, AMI                                     |
| Scale-to-zero                | Yes (no cost when idle)                                                                                                                                  | No (tasks run continuously)                                                                                                   | No (instances run continuously)                                             |
| Max single execution         | **15 min hard limit** ([source](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html))                                                | Unlimited (long-running process)                                                                                              | Unlimited                                                                   |
| Cold start                   | "Under 100 ms to over 1 second" first invoke ([source](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html#cold-start-latency)) | Task start: tens of seconds (image pull + boot)                                                                               | Instance launch: 1-2+ minutes                                               |
| Persistent connections       | No (per-invoke; pool with [RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html))                                            | Yes (long-lived process holds connections)                                                                                    | Yes                                                                         |
| WebSockets / long-lived HTTP | No on Function URL; need API Gateway WebSocket API                                                                                                       | Yes                                                                                                                           | Yes                                                                         |
| Pricing model                | Per-request + per-GB-second ($0.20/M req + $0.0000166667/GB-s, x86, us-east-1) ([source](https://aws.amazon.com/lambda/pricing/))                        | Per-vCPU-second + per-GB-second ($0.04048/vCPU-hr + $0.004445/GB-hr, x86) ([source](https://aws.amazon.com/fargate/pricing/)) | Per-instance-hour ([source](https://aws.amazon.com/ec2/pricing/on-demand/)) |
| Memory range                 | 128 MB to 10,240 MB in 1-MB increments ([source](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html))                               | 0.5 GB to 120 GB (per task)                                                                                                   | Per instance type (up to TBs)                                               |
| Sync request/response cap    | **6 MB each** sync, 1 MB async ([source](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html))                                       | None                                                                                                                          | None                                                                        |
| Local-dev parity             | Low (SAM / SST / serverless-offline approximate the runtime)                                                                                             | High (Docker locally)                                                                                                         | High (just run the binary)                                                  |
| When AWS has nothing to do   | Charged $0                                                                                                                                               | Still charged for the running task                                                                                            | Still charged for the running instance                                      |

## Where Lambda wins

These are the workloads Lambda was actually built for. The tradeoffs above become assets, not liabilities.

- **Event-driven glue**: S3 `ObjectCreated` → resize image, DynamoDB stream → push notification, EventBridge rule → enrich record, SNS → fan-out worker. The trigger pays the cold start; the function runs sub-second; you scale from 0 to thousands of concurrent invocations without provisioning.
- **Cron with low duty cycle**: a daily report at 06:00 that runs for 30 seconds is ~$0/month on Lambda and ~$8.35/month on a `t3.micro` running 24/7 ($0.0104/hr × 720 hr) ([source](https://aws.amazon.com/ec2/pricing/on-demand/)). Same for ad-hoc cleanup jobs, weekly batch ETLs, expiring-token sweepers.
- **Spiky webhooks**: GitHub webhook receiver, Stripe events, OAuth callbacks. Traffic is unpredictable, request volume per month is low, and you don't want to pay for an idle EC2 instance to catch the occasional burst.
- **Per-tenant or per-customer isolation**: one function per tenant scales to zero per tenant; impossible to do efficiently with always-on instances.

## Where Lambda hurts a long-lived backend

The "everything is Lambda" reflex pushes monolith-shaped workloads into a request model that wasn't designed for them. Each pain below has a workaround, and each workaround costs money or operational complexity that an EC2/Fargate setup wouldn't pay.

### Cold starts and the warming-cron anti-pattern

Per the [Lambda runtime docs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html#cold-start-latency): "Cold starts typically occur in under 1% of invocations. The duration of a cold start varies from under 100 ms to over 1 second." The Init phase runs three things: extension init, runtime init, and your function's static code (imports, DB clients, etc.) ([source](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html#runtimes-lifecycle-ib)). Heavy frameworks (NestJS, Spring, large bundles) push that toward and beyond 1 second per cold start.

The two AWS-blessed workarounds:

1. **Provisioned Concurrency** keeps N execution environments pre-initialized, billed at $0.0000041667 per GB-second whether they handle traffic or not ([source](https://aws.amazon.com/lambda/pricing/)). For a 512 MB function with 10 reserved environments, that's roughly $54/month before any invocation cost (10 × 0.5 GB × $0.0000041667 × 86,400 s/day × 30 days). The math gets worse fast as you reserve more.
2. **SnapStart** snapshots the post-init state and resumes from it (Java, Python, .NET) ([source](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html#runtimes-lifecycle-restore)). Cuts cold start sharply for languages where Init dominates; not a universal fix.

The unblessed workaround you'll see in the wild: a CloudWatch Events rule pinging the function every 5 minutes to keep one environment warm. Costs near-zero, hides the underlying problem (your monolith doesn't fit Lambda's lifecycle), and only keeps **one** environment warm: the second concurrent request still cold-starts.

### DB connections and why you need RDS Proxy

A function instance opens a DB connection, the invocation ends, the execution environment is frozen, and the connection sits idle until either the next invocation reuses the env or AWS reaps it (terminated "every few hours") ([source](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html#runtimes-lifecycle-shutdown)). Under load, every concurrent execution opens its own connection: 200 concurrent Lambdas → 200 PostgreSQL connections, exhausting the database's `max_connections` limit.

[RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html) sits between the functions and the DB, pooling and reusing actual database connections. Per AWS: "RDS Proxy establishes a database connection pool and reuses connections in this pool. This approach avoids the memory and CPU overhead of opening a new database connection each time."

The cost: **$0.015 per vCPU-hour, multiplied by the vCPUs of the underlying DB instance** ([source](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/us-east-1/index.json), `USE1-RDS:ProxyUsage`). For a 4-vCPU `db.r5.xlarge`: 4 × $0.015 × 24 × 30 = **$43.20/month**, on top of the database itself. That's the price of a small EC2 instance, paid every month, to solve a problem an EC2/Fargate backend doesn't have.

### The 15-minute hard ceiling

Function timeout is "900 seconds (15 minutes)" ([source](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)). Period. A long video transcode, a multi-step migration, a slow third-party API integration that takes 20 minutes — all of these need to be split into a state-machine (Step Functions), redesigned around durable execution, or moved to Fargate/EC2.

> [!warning] Durable Functions raise the ceiling but change the programming model
> Lambda Durable Functions can run "up to one year" by checkpointing state ([source](https://docs.aws.amazon.com/lambda/latest/dg/durable-functions.html)), but the function code has to be written against the durable-execution SDK with explicit checkpoints and idempotent operations. It's not "the timeout was lifted"; it's a different runtime contract you opt into.

### Payload caps

"6 MB each for request and response (synchronous), 1 MB (asynchronous)" ([source](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)). A REST endpoint that returns a 10 MB JSON document doesn't work on Lambda; you stream from S3 (with [[aws/s3/presigned-urls|presigned URLs]]) or use the Lambda response-streaming feature (200 MB cap, 2 MBps after the first 6 MB). Neither is "just return the body" the way EC2/Fargate handles it.

### No long-lived sockets on the function itself

WebSockets, server-sent events, long-poll connections: none of these run on the Lambda function. You front them with API Gateway's WebSocket API (which holds the socket and invokes Lambda per message) or you pick a different compute. For a real-time backend, this is the wrong primitive.

### Local development drift

The official tools (AWS SAM, Serverless Framework, SST) and the community ones (`serverless-offline`) all approximate the Lambda runtime locally. None reproduce it exactly: cold-start timing, env-var injection, IAM context, VPC ENI behavior, and concurrency limits all diverge from production. The team pays a steady tax in "works locally, fails in Lambda" debugging that EC2/Fargate (where local Docker = production Docker) doesn't charge.

## Where Fargate is the honest middle

When the workload is "long-lived backend" but the team genuinely doesn't want to manage instances, Fargate is the answer that "everything is Lambda" hides:

- **Same container locally and in prod** (Docker → ECS task definition); no runtime drift.
- **No node patching, no AMI rebuilds, no autoscaling-group config.** AWS schedules tasks onto its own capacity.
- **Persistent connections, long-running processes, WebSockets, 10 GB+ memory**: none of Lambda's request-model limits.
- **Predictable per-task cost.** $0.04048/vCPU-hour and $0.004445/GB-hour for x86, ~20% cheaper on Graviton (Arm) ([source](https://aws.amazon.com/fargate/pricing/)). A 0.5 vCPU / 1 GB task is ~$15/month all-in.
- **Spot for ~70% off** on interruptible workloads ([source](https://aws.amazon.com/fargate/pricing/)).

The premium vs raw EC2 is real but predictable. For most "I need a backend" workloads, Fargate is what you actually want when you're tempted to reach for Lambda for ops simplicity.

## Where EC2 still wins

- **Sustained high throughput** where the per-request Lambda model loses on price (see math below).
- **Persistent connections at scale**: a single EC2 instance can hold tens of thousands of WebSocket connections; an equivalent Lambda + API Gateway WebSocket API setup costs an order of magnitude more per connection-hour.
- **GPU, custom kernel, /proc tuning, SR-IOV (Single-Root I/O Virtualization, the bypass that lets a VM talk to the NIC directly for higher throughput and lower jitter) networking, FPGA**: none available on Lambda or Fargate.
- **Reserved Instances and Savings Plans** discount sustained usage 30-72% off on-demand for 1- or 3-year commitments. Lambda has no equivalent commitment discount on the per-request side.
- **Lift-and-shift**: existing on-prem applications port to EC2 unchanged; Lambda demands a rewrite around the handler model.

## Pricing math: one concrete workload

> [!info]- Verified 2026-05-10, us-east-1, on-demand pricing
> AWS pricing changes; the relative shape (Lambda is per-request, EC2 is per-hour) is what matters, not the dollar precision. Re-check the [Lambda](https://aws.amazon.com/lambda/pricing/), [EC2](https://aws.amazon.com/ec2/pricing/on-demand/), and [Fargate](https://aws.amazon.com/fargate/pricing/) pricing pages before quoting these numbers in a serious decision.

Workload: a backend API serving sustained **50 requests/second** with **200 ms average duration** on **512 MB** of memory. ~129.6M requests/month.

**Lambda (x86, us-east-1)** ([source](https://aws.amazon.com/lambda/pricing/)):

- Requests: 129.6M × $0.20/M = **$25.92**
- Compute: 0.2 s × 0.5 GB × 129.6M = 12.96M GB-seconds × $0.0000166667 = **$216.00**
- Free tier: -$0.20 requests, -$6.67 GB-s
- **Total: ~$235/month** (before RDS Proxy)
- Add RDS Proxy on a 4-vCPU DB: +$43.20/month → **~$278/month**

**EC2 `m7g.medium` (1 vCPU, 4 GB, Graviton, on-demand, us-east-1)** ([source](https://aws.amazon.com/ec2/pricing/on-demand/)):

- $0.0408/hour × 24 × 30 = **$29.38/month**
- No RDS Proxy needed (the always-on process holds a small pool of long-lived connections)

**Fargate (1 vCPU, 2 GB, x86, on-demand)** ([source](https://aws.amazon.com/fargate/pricing/)):

- vCPU: $0.04048 × 24 × 30 = $29.15
- Memory: 2 × $0.004445 × 24 × 30 = $6.40
- **Total: ~$35.55/month**

At this workload, **Lambda is roughly 8× the cost of `m7g.medium` and 7× the cost of Fargate**, before any RDS Proxy or Provisioned Concurrency. The crossover point (where Lambda matches `m7g.medium` at $29.38) is around **6 req/s sustained** with these per-invocation parameters: well below "high traffic". For lower per-invocation cost (smaller memory, shorter duration), the crossover shifts higher; for heavier invocations it shifts lower.

> [!warning] These numbers are for one workload shape: re-do the math for yours
> Lambda's pricing is linear in `requests × memory × duration`; EC2's is constant per hour. The crossover depends entirely on the per-invocation cost. A 100ms × 128 MB function crosses much later than a 2 s × 2048 MB function. Use the [AWS pricing calculator](https://calculator.aws/) with your real numbers, not these.

## Decision shortcuts

When you're tempted to default to Lambda, walk these in order:

1. **Does the work need to run > 15 minutes per invocation?** → Fargate or EC2 (or Step Functions / Durable Functions if you can checkpoint).
2. **Is it triggered by a discrete event (S3, SQS, EventBridge, schedule)?** → Lambda is probably right; the event source pays the cold start, the function does its job, you owe nothing when idle.
3. **Is it a sustained backend serving HTTP traffic continuously?** → Run the pricing math; if you're north of ~5-10 req/s sustained, Fargate or EC2 wins. Lambda's "ops simplicity" stops being free once you add RDS Proxy and Provisioned Concurrency.
4. **Do you need persistent connections (WebSockets, long-poll, MQTT) or > 6 MB responses?** → Not Lambda. Fargate or EC2.
5. **Is local-dev parity important to the team?** → Fargate or EC2; the Lambda local-runtime simulators all drift.
6. **Are you using Lambda specifically because the team doesn't want to manage instances?** → Fargate is the honest answer to that goal. It scales tasks like Lambda scales functions, without the per-request constraints.

## Common gotchas when shoehorning a backend into Lambda

> [!warning]- Provisioned Concurrency doesn't eliminate cold starts on scale-out
> PC keeps N environments warm. The N+1th concurrent request still cold-starts (or queues, depending on your config). Sizing PC to peak traffic defeats the "scale to zero" benefit and approaches the cost of always-on compute. Per the [PC docs](https://docs.aws.amazon.com/lambda/latest/dg/provisioned-concurrency.html): you're explicitly trading scale-to-zero for predictable latency.

> [!warning]- The 5-minute warming cron only warms one environment
> CloudWatch Events → Lambda every 5 minutes keeps a single execution environment alive. The moment two requests arrive in the same window, one of them cold-starts. It's a partial fix dressed up as a complete one.

> [!warning]- IAM permission errors during Init kill the whole environment
> If your function's static initialization (DB client, S3 client) fails because the execution role lacks a permission, the Init phase fails, the environment is reset, and the next invocation runs Init again ([source](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html#runtimes-lifecycle-init-errors)). Reads as "intermittent latency spikes" in monitoring; root cause is missing IAM.

> [!info]- Lambda + VPC adds an ENI cost, not just latency
> Putting a function in a VPC (to reach private RDS, for example) attaches a Hyperplane ENI (a shared, NAT-style ENI managed by AWS that fronts many functions onto the customer's subnet, instead of attaching a dedicated ENI per concurrent execution like the pre-2019 design) to the execution environment. Cold starts are no longer dramatically slower than non-VPC since the 2019 networking redesign, but each VPC consumes ENI quota (default 500/VPC, shared with EFS) ([source](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)). Worth knowing before mass-deploying VPC-attached functions.

## See also

- [[aws/lambda/index|Lambda]]: the function-level concept note (memory/timeout config, triggers, versions/aliases).
- [[aws/ec2/index|EC2]]: the VM-level concept note (instance types, AMIs, EBS, security groups).
- [[aws/ecs/index|ECS and Fargate]]: container orchestration with task definitions and services.
- [[aws/rds/index|RDS]]: where RDS Proxy lives and why Lambda + RDS specifically asks for it.
- [AWS Lambda developer guide](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) (official).
- [AWS Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html) (official): the hard limits in one place.
- [Lambda pricing](https://aws.amazon.com/lambda/pricing/), [EC2 on-demand pricing](https://aws.amazon.com/ec2/pricing/on-demand/), [Fargate pricing](https://aws.amazon.com/fargate/pricing/) (official).
- [RDS Proxy overview](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html) (official).

### Further reading

- ["EC2 vs Lambda: when to use which, with real examples"](https://faun.pub/ec2-vs-lambda-when-to-use-which-with-real-examples-a4abc43ec443) (FAUN Publication blog): practitioner framing of the same decision tree, with worked use-case examples. The tradeoff lens above (event-driven vs sustained backend, the warming-cron and RDS Proxy gotchas) was inspired by this article; every concrete claim was re-verified against AWS primary sources before landing here.
