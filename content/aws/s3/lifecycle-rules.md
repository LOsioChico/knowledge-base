---
title: S3 lifecycle rules
aliases: [s3 lifecycle, lifecycle policy, s3 transition rule, s3 expiration rule]
tags: [type/concept, tech/aws, tech/s3]
area: aws
status: evergreen
related:
  - "[[aws/s3/index]]"
  - "[[aws/s3/quickstart]]"
  - "[[aws/s3/storage-classes]]"
  - "[[aws/recipes/index]]"
source:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/intro-lifecycle-rules.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html
---

> A lifecycle configuration is a per-bucket set of up to 1,000 rules that age objects automatically: transition them to a cheaper [[aws/s3/storage-classes|storage class]] after N days, or delete them outright. It's the only mechanism that scales to billions of objects without writing code.

## Why you need one

Three default-on costs that lifecycle rules contain:

1. **Versioning sprawl.** Every overwrite of a 1 GB file in a versioned bucket adds another 1 GB to the bill, forever, unless `NoncurrentVersionExpiration` cleans up old versions.
2. **Stale data in expensive storage.** Logs uploaded in 2022 don't need millisecond access in 2026; transitioning aged objects to Glacier slashes the per-GB rate (often by an order of magnitude on long-tail data, depending on access pattern). See [[aws/s3/storage-classes|S3 storage classes]] for the per-class trade-offs.
3. **Failed multipart uploads.** When a large upload aborts (network drop, client crash), the parts that did upload remain billable until you explicitly clean them up via `AbortIncompleteMultipartUpload`. Easy to forget.

## Minimum rule shape

Every rule needs an ID, a status, a filter, and at least one action. Configure via `aws s3api put-bucket-lifecycle-configuration` with a JSON document:

```json
{
  "Rules": [
    {
      "ID": "expire-temp-uploads",
      "Status": "Enabled",
      "Filter": { "Prefix": "tmp/" },
      "Expiration": { "Days": 7 }
    }
  ]
}
```

Save as `lifecycle.json` and apply:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-bucket \
  --lifecycle-configuration file://lifecycle.json
```

This deletes any object under `tmp/` 7 days after creation. Existing objects older than 7 days become eligible immediately ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html#object-lifecycle-mgmt)).

## A realistic multi-action rule

Aging app logs: keep hot for 30 days, IA for 60 more, archive for 6 years, then delete. Plus, clean up versioned overwrites and failed uploads.

```json
{
  "Rules": [
    {
      "ID": "logs-tiering",
      "Status": "Enabled",
      "Filter": { "Prefix": "logs/" },
      "Transitions": [
        { "Days": 30, "StorageClass": "STANDARD_IA" },
        { "Days": 90, "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 2555 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 30 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}
```

## The five action elements

| Action                           | What it does                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Transition`                     | Move current-version objects to a different storage class after N days.                                   |
| `Expiration`                     | Delete current-version objects after N days. On versioned buckets, just adds a delete marker.             |
| `NoncurrentVersionTransition`    | Move noncurrent (overwritten) versions to a different class after N days since they became noncurrent.    |
| `NoncurrentVersionExpiration`    | Permanently delete noncurrent versions after N days. **This is the one that prevents versioning sprawl.** |
| `AbortIncompleteMultipartUpload` | Cancel and clean up multipart uploads still in progress after N days. Stops billing for orphaned parts.   |

There's also `ExpiredObjectDeleteMarker` (clean up delete markers with no remaining versions): niche, useful for versioned buckets that turn over fully.

## Filter options

A rule's `Filter` decides which objects it matches. Pick one combination:

- `{}`: empty filter, applies to every object in the bucket.
- `{ "Prefix": "logs/" }`: key prefix. The most common case.
- `{ "Tag": { "Key": "...", "Value": "..." } }`: single tag.
- `{ "ObjectSizeGreaterThan": 128000 }`: only objects above N bytes (exclusive).
- `{ "ObjectSizeLessThan": 1048576 }`: only objects below N bytes (exclusive).
- `{ "And": { "Prefix": "...", "Tags": [...], "ObjectSizeGreaterThan": ... } }`: combine multiple conditions with logical AND. Use `And` whenever you have more than one filter element.

> [!warning]- Default size floor: objects under 128 KB don't transition
> Lifecycle transitions skip objects smaller than 128 KB by default to avoid thrashing tiny files between classes ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/intro-lifecycle-rules.html#intro-lifecycle-rules-filter)). If you need them moved, set `ObjectSizeGreaterThan` to a smaller value explicitly.

## Transition rules and the 30-day floor

Not every class-to-class transition is allowed. The two practical constraints:

- **Standard → IA classes ([[aws/s3/storage-classes|Standard-IA]], One Zone-IA): minimum 30 days.** AWS rejects rules that try to transition sooner because IA classes have a 30-day minimum storage charge anyway: moving earlier costs more, not less.
- **Smaller-to-larger storage class only.** You can transition Standard → IA → Glacier → Deep Archive, but not the reverse. To "un-archive" an object, restore it (which copies it back to Standard temporarily) or copy it manually.

See [Supported transitions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html#lifecycle-general-considerations-transition-sc) for the full matrix.

## Versioning interactions (the part everyone misses)

On a versioned bucket:

- `Expiration` on the **current version** does NOT delete bytes. It inserts a delete marker. The "deleted" object is still there as a noncurrent version, still billed.
- To actually free space, you also need `NoncurrentVersionExpiration` with `NoncurrentDays` set to whatever recovery window you want (often 7-30 days).
- If you skip `NoncurrentVersionExpiration`, your bill grows monotonically forever. This is the single most common S3 cost overrun.

## When rules conflict

When two rules match the same object, [[aws/s3/index|Amazon S3]] prefers the **least expensive transition and the soonest expiration**. There's no priority field; design rules so they don't overlap, or use distinct prefixes/tags to keep them disjoint. Full conflict-resolution rules: [How Amazon S3 handles conflicts](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-conflicts.html).

## Inspecting and removing

```bash
aws s3api get-bucket-lifecycle-configuration --bucket my-bucket
aws s3api delete-bucket-lifecycle --bucket my-bucket
```

Lifecycle changes are eventually consistent: give it a few minutes before assuming a new rule didn't take effect. Bucket policies cannot block lifecycle deletions ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)): even a `Deny *` policy will not stop a lifecycle expiration from running.

## See also

- [[aws/s3/index|S3]] (parent concept).
- [[aws/s3/storage-classes|S3 storage classes]] (what you're transitioning to).
- [Examples of S3 Lifecycle configurations](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-configuration-examples.html) (official, broader examples).
