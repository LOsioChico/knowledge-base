---
title: S3 storage classes
aliases: [s3 storage tiers, s3 standard, s3 glacier, intelligent-tiering, standard-ia]
tags: [type/concept, tech/aws, tech/s3]
area: aws
status: evergreen
related:
  - "[[aws/s3/index]]"
  - "[[aws/s3/quickstart]]"
  - "[[aws/index]]"
  - "[[aws/s3/lifecycle-rules]]"
  - "[[aws/s3/event-notifications]]"
source:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html
  - https://aws.amazon.com/s3/pricing/
---

> Every S3 object has a storage class. The class controls per-GB storage cost, retrieval cost, latency, and how many Availability Zones (AZs) the bytes live in. Pick wrong and you either overpay for storage you barely read, or pay surprise retrieval fees on data you read constantly.

## TL;DR

- **Default to Standard.** Same-millisecond latency, no minimum duration, no retrieval fee, three or more AZs. The other classes are optimizations, not upgrades.
- **Use Intelligent-Tiering when you don't know the access pattern.** It moves objects between tiers automatically; no retrieval fee; charges a small per-object monitoring fee instead.
- **Use Standard-IA / One Zone-IA only for data you know is rarely read.** IA = Infrequent Access. They charge a per-GB **retrieval fee** that wipes out the storage savings if you read more than ~once a month.
- **Use Glacier classes for archives.** Cheapest storage, but retrieval is metered AND, for Flexible Retrieval and Deep Archive, requires an explicit `RestoreObject` call that takes minutes to hours.
- **Don't use Reduced Redundancy.** AWS officially recommends against it; Standard is now cheaper.

## Reference table

All durability is "11 nines" (`99.999999999%`) except Reduced Redundancy. Numbers below come straight from the AWS storage-class comparison ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html#sc-compare)).

| Class                         | API name              | Availability (designed for) | AZs | Min duration | Min billable size | Retrieval fee   |
| ----------------------------- | --------------------- | --------------------------- | --- | ------------ | ----------------- | --------------- |
| S3 Standard                   | `STANDARD`            | 99.99%                      | ≥ 3 | None         | None              | No              |
| S3 Intelligent-Tiering        | `INTELLIGENT_TIERING` | 99.9%                       | ≥ 3 | None         | None              | No (monitoring) |
| S3 Standard-IA                | `STANDARD_IA`         | 99.9%                       | ≥ 3 | 30 days      | 128 KB            | Yes, per GB     |
| S3 One Zone-IA                | `ONEZONE_IA`          | 99.5%                       | 1   | 30 days      | 128 KB            | Yes, per GB     |
| S3 Express One Zone           | `EXPRESS_ONEZONE`     | 99.95%                      | 1   | None         | None              | No              |
| S3 Glacier Instant Retrieval  | `GLACIER_IR`          | 99.9%                       | ≥ 3 | 90 days      | 128 KB            | Yes, per GB     |
| S3 Glacier Flexible Retrieval | `GLACIER`             | 99.99% (after restore)      | ≥ 3 | 90 days      | NA\*              | Yes, per GB     |
| S3 Glacier Deep Archive       | `DEEP_ARCHIVE`        | 99.99% (after restore)      | ≥ 3 | 180 days     | NA\*\*            | Yes, per GB     |
| Reduced Redundancy            | `REDUCED_REDUNDANCY`  | 99.99%                      | ≥ 3 | None         | None              | No              |

\* S3 Glacier Flexible Retrieval requires 40 KB of additional metadata per archived object (32 KB at the Glacier Flexible Retrieval rate, 8 KB at the S3 Standard rate). \*\* S3 Glacier Deep Archive does the same: 40 KB of metadata per object (32 KB at the Deep Archive rate, 8 KB at the S3 Standard rate). There is no per-object minimum billable size on either, just the metadata overhead ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html#sc-compare)).

## When to reach for which

### Standard

The default. If you're uploading data you actually plan to read, use this and stop thinking about it. Cost optimization comes from [[aws/s3/lifecycle-rules|lifecycle rules]] that _transition_ aged objects to a cheaper class later, not from picking the cheap class up front.

### Intelligent-Tiering

The "I don't know how often this will be read" answer. Objects auto-move between Frequent Access, Infrequent Access (after 30 days idle), and Archive Instant Access (after 90 days idle). Two optional async tiers exist on top of those (Intelligent-Tiering's _Archive Access_ at 90+ days idle, and _Deep Archive Access_ at 180+ days idle: distinct from the standalone Glacier classes below); both require explicit activation per bucket and a `RestoreObject` call to read ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html#sc-dynamic-data-access)).

The trap: objects smaller than 128 KB are **never monitored** and always billed at the Frequent Access rate ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html#sc-dynamic-data-access)). If your workload is millions of tiny files (thumbnails, log lines), Intelligent-Tiering is wasted money: pick Standard or pre-aggregate.

### Standard-IA and One Zone-IA

Both target "I'll read this maybe once a month for the next year+" data: backups, older logs, replicated copies. Storage is meaningfully cheaper than Standard, but the retrieval fee makes them a footgun:

> [!warning]- Reading IA data more than ~once a month costs MORE than Standard
> Per-GB retrieval fees apply on every GET. The break-even point is roughly one full read of the object per month: read it twice and IA is more expensive than Standard. Use [Storage Class Analysis](https://docs.aws.amazon.com/AmazonS3/latest/userguide/analytics-storage-class.html) to validate access patterns before transitioning.

The 30-day minimum duration is also strict: delete on day 5 and you still pay 30 days. The 128 KB minimum billable size means a 1 KB object costs the same as a 128 KB object.

**Standard-IA vs One Zone-IA**: One Zone-IA stores in a single AZ, costs ~20% less, and is **not resilient to AZ loss**. AWS's recommendation: use Standard-IA for primary copies, One Zone-IA only for re-creatable data (Cross-Region Replication (CRR) replicas, secondary thumbnails) or for [data-residency / Local Zone use cases](https://docs.aws.amazon.com/AmazonS3/latest/userguide/directory-bucket-data-residency.html).

### Glacier classes

Three flavors, in order of "how patient are you":

- **Glacier Instant Retrieval** (`GLACIER_IR`). Millisecond access like Standard, but priced for "once a quarter" reads. 90-day minimum. Use when data is rarely read but the read MUST be fast (compliance archives that auditors might pull).
- **Glacier Flexible Retrieval** (`GLACIER`). Retrieval is asynchronous, with three speed tiers: **Expedited** (minutes), **Standard** (hours), **Bulk** (hours, cheapest). 90-day minimum. Requires a `RestoreObject` call before the first GET ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/restoring-objects-retrieval-options.html)).
- **Glacier Deep Archive** (`DEEP_ARCHIVE`). Cheapest S3 storage, period. Two speed tiers: **Standard** and **Bulk**, both measured in hours. 180-day minimum. Tape-replacement use cases: regulatory data you keep for 7 years and read approximately never.

> [!info]- Glacier objects still live in S3, not the standalone Glacier service
> Despite the name, you GET them through the same S3 API; you don't go to the separate Amazon Glacier console. The "S3 Glacier" name describes the storage tier, not a different service.

### Express One Zone

Single-digit-millisecond latency, single AZ, request costs ~50% lower than Standard. Pairs with **directory buckets** (a different bucket type, not general-purpose). Use for latency-sensitive workloads in one AZ: ML training data co-located with GPU instances, real-time analytics, etc. Lose the AZ, lose the data.

### Reduced Redundancy

Don't. AWS's own guidance: "We recommend not using this storage class. The S3 Standard storage class is more cost-effective" ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html#sc-freq-data-access)). It predates the current pricing of Standard and exists only for backwards compatibility.

## Setting the class

Three places it gets decided:

- **At PUT time.** Pass `--storage-class STANDARD_IA` (or any of the API names above) to `aws s3 cp`, `PutObject`, or any SDK upload call. Default is Standard.
- **Via lifecycle rule** (`Transition` action). Most common pattern: upload to Standard, transition to Standard-IA after 30 days, to Glacier after 90 days, expire after 7 years. See [Managing lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html).
- **At copy time.** `aws s3 cp s3://bucket/key s3://bucket/key --storage-class GLACIER` rewrites the object in place at the new class.

## See also

- [[aws/s3/index|S3]] (the parent concept note).
- [Comparing the Amazon S3 storage classes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html#sc-compare) (official table).
- [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/) (per-class per-region rates).
