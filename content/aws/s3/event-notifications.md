---
title: S3 event notifications
aliases: [s3 events, s3 object created event, s3 lambda trigger, s3 sqs notification]
tags: [type/concept, tech/aws, tech/s3]
area: aws
status: evergreen
related:
  - "[[aws/s3/index]]"
  - "[[aws/s3/storage-classes]]"
  - "[[aws/lambda/index]]"
  - "[[aws/recipes/index]]"
source:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html
---

> S3 event notifications fire a message to SNS, SQS, [[aws/lambda/index|Lambda]], or EventBridge (Amazon's managed event-routing bus) whenever a configured event happens to an object (created, removed, restored, tagged, replicated, etc.). It's how you turn a passive bucket into the front of an event-driven pipeline.

## What can trigger a notification

S3 publishes events for ten kinds of object lifecycle activity, including auto-tiering driven by [[aws/s3/storage-classes|Intelligent-Tiering]] ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html#supported-notification-event-types)):

| Event family              | Wildcard                   | Concrete events                                                                                             |
| ------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Object created            | `s3:ObjectCreated:*`       | `Put`, `Post`, `Copy`, `CompleteMultipartUpload`                                                            |
| Object removed            | `s3:ObjectRemoved:*`       | `Delete`, `DeleteMarkerCreated`                                                                             |
| Object restored (Glacier) | `s3:ObjectRestore:*`       | `Post` (initiated), `Completed`, `Delete` (restored copy expired)                                           |
| Replication               | `s3:Replication:*`         | `OperationFailedReplication`, `OperationMissedThreshold`, `OperationReplicatedAfterThreshold`, `NotTracked` |
| Lifecycle expiration      | `s3:LifecycleExpiration:*` | `Delete`, `DeleteMarkerCreated`                                                                             |
| Lifecycle transition      | (no wildcard)              | `s3:LifecycleTransition`                                                                                    |
| Intelligent-Tiering       | (no wildcard)              | `s3:IntelligentTiering`                                                                                     |
| Object tagging            | `s3:ObjectTagging:*`       | `Put`, `Delete`                                                                                             |
| Object ACL                | (no wildcard)              | `s3:ObjectAcl:Put`                                                                                          |
| RRS object lost           | (no wildcard)              | `s3:ReducedRedundancyLostObject` (RRS = the legacy Reduced Redundancy Storage class)                        |

`ObjectRemoved:*` notifications **do not fire for lifecycle deletes**: that's what `LifecycleExpiration:*` is for. Easy to miss.

## Destinations

Four options. Each event configuration picks exactly one destination:

- **SQS queue** (Standard only: FIFO is not supported as a direct S3 destination; route through EventBridge if you need FIFO).
- **SNS topic** (Standard only).
- **Lambda function** (most common for "do something synchronous on upload").
- **EventBridge** (all-or-nothing toggle: when enabled, every event in the bucket goes to the default event bus, and you filter with EventBridge rules instead of S3 filters).

The destination must be in the **same Region** as the bucket. The bucket needs explicit permission to publish (a resource policy on the SNS/SQS/Lambda allowing `s3.amazonaws.com`).

## Minimum config (SQS, prefix-filtered)

```json
{
  "QueueConfigurations": [
    {
      "Id": "uploads-to-process",
      "QueueArn": "arn:aws:sqs:us-east-1:123456789012:uploads-queue",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            { "Name": "prefix", "Value": "incoming/" },
            { "Name": "suffix", "Value": ".jpg" }
          ]
        }
      }
    }
  ]
}
```

Apply it:

```bash
aws s3api put-bucket-notification-configuration \
  --bucket my-bucket \
  --notification-configuration file://notification.json
```

S3 sends a one-time `s3:TestEvent` to the destination on configuration to verify permissions. If you don't see it, the destination policy is wrong.

## Filter rules

Only two filter dimensions are supported, both on the object key:

- `prefix`: match keys starting with N characters.
- `suffix`: match keys ending with N characters.

That's it. No tag filtering, no size filtering, no content-type filtering. If you need any of those, route everything to EventBridge (or to a Lambda) and filter there.

> [!warning]- Overlapping prefix/suffix filters are forbidden across rules
> Two rules in the same bucket cannot both match the same object. Configuring `incoming/*.jpg` for queue A and `incoming/photo*` for queue B will be rejected with `Configurations overlap`. Workarounds: use disjoint prefixes (`incoming/jpg/`, `incoming/png/`) or fan out via SNS to multiple subscribers.

## Delivery semantics

- **At-least-once.** S3 retries on destination failure. Your handler must be idempotent.
- **Not ordered.** Two near-simultaneous PUTs to the same key can arrive in either order. Don't infer "the latest one" from delivery order: read the object's `versionId` or `LastModified` from the event payload.
- **Typically delivered in seconds**, but the docs explicitly say "can sometimes take a minute or longer" ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/EventNotifications.html#EventNotifications)). Don't build sub-second SLAs on top.
- **Duplicates happen.** Same object event can fire twice on rare retries.

## The recursion footgun

```
client → PUT s3://bucket/in/file.jpg
         → s3:ObjectCreated event → Lambda
         → Lambda processes, PUTs s3://bucket/out/file.jpg
         → s3:ObjectCreated event → Lambda (again!)
```

If the Lambda's output goes back to the same bucket without a prefix filter, you've built an infinite loop billed by the second. Two safe patterns:

1. **Two buckets**: input bucket triggers, output bucket doesn't.
2. **Disjoint prefixes** with the trigger filter scoped to the input prefix only (e.g., trigger only on `in/`, write outputs to `out/`).

The S3 docs call this out explicitly ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-how-to-event-types-and-destinations.html#lambda-function)). It's the most-cited S3+Lambda incident on AWS bills.

## When to pick EventBridge instead

EventBridge as the S3 destination is a single bucket-level toggle that ships every event to the default bus. Reach for it when:

- You want **content-based filtering** beyond prefix/suffix (filter on `eventName`, `object.size`, `object.key` patterns, etc.).
- You want **multiple downstream consumers** without managing SNS fan-out.
- You need **SQS FIFO** as a downstream (only reachable via EventBridge).
- You want a **uniform event format** across services (EventBridge envelope vs S3's bespoke `Records[]` format).

Trade-off: per-event cost is slightly higher and you lose the per-rule key filtering on the S3 side (every event leaves the bucket).

## See also

- [[aws/s3/index|S3]] (parent concept).
- [[aws/lambda/index|Lambda]] (most common destination).
- [Using AWS Lambda with Amazon S3](https://docs.aws.amazon.com/lambda/latest/dg/with-s3.html) (full Lambda+S3 walkthrough).
- [Enabling Amazon EventBridge for S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/enable-event-notifications-eventbridge.html) (the toggle and event schema).
