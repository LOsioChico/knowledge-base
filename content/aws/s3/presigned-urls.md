---
title: S3 presigned URLs
aliases: [s3 presigned url, presigned upload, signed url, share s3 object temporarily]
tags: [type/recipe, tech/aws, tech/s3]
area: aws
status: evergreen
related:
  - "[[aws/s3/index]]"
  - "[[aws/s3/quickstart]]"
  - "[[aws/iam/index]]"
  - "[[aws/cloudfront/index]]"
  - "[[aws/lambda/index]]"
  - "[[aws/lambda-vs-ec2]]"
  - "[[aws/secrets-manager]]"
  - "[[aws/recipes/index]]"
source:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
---

> A presigned URL is a normal HTTPS URL with a signature attached that grants time-limited permission to perform one S3 operation (GET, PUT, HEAD, etc.) on one specific object. The signature is computed from your AWS credentials, so the recipient never needs an AWS account to use it.

## When to reach for one

- **You want a browser to download a private object** without making the bucket public. The link expires; the bucket stays locked.
- **You want a browser to upload directly to S3** without proxying bytes through your backend. Your server signs a `PUT` URL; the client PUTs straight to S3.
- **You want to share a file with someone outside your AWS org** for a few hours / days without provisioning [[aws/iam/index|IAM]] for them.

If the use case is "always-public [[aws/cloudfront/index|CDN]] content", front the bucket with CloudFront and skip presigned URLs entirely.

## Generate one with the CLI

```bash
aws s3 presign s3://my-bucket/path/to/object.pdf --expires-in 3600
```

`--expires-in` is in **seconds**. The CLI default is 3600 (1 hour); the **maximum is 604800 seconds (7 days)** when using AWS Signature Version 4 ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html#ShareObjectPresignedCLI)).

The output is a long URL with `X-Amz-Signature`, `X-Amz-Expires`, `X-Amz-Credential`, etc. Anyone with that URL can `curl` the file until it expires:

```bash
curl -o object.pdf "<presigned-url>"
```

## Generate one with the SDK (NestJS + AWS SDK v3)

The Node.js v3 SDK splits presigning into its own package: `@aws-sdk/client-s3` provides the command (`GetObjectCommand`, `PutObjectCommand`), and `@aws-sdk/s3-request-presigner` provides `getSignedUrl`, which signs a command without sending it ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/example_s3_Scenario_PresignedUrl_section.html)).

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

```typescript
import { Injectable } from "@nestjs/common";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

@Injectable()
export class S3PresignService {
  private readonly s3 = new S3Client({ region: "us-east-1" });
  private readonly bucket = "my-bucket";

  // GET URL: lets the holder download
  async downloadUrl(key: string): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, cmd, { expiresIn: 3600 }); // 1 hour, in seconds
  }

  // PUT URL: lets the holder upload to that exact key
  async uploadUrl(key: string): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, cmd, { expiresIn: 900 }); // 15 minutes
  }
}
```

`expiresIn` is seconds, same shape as the CLI's `--expires-in`. The `S3Client` reads credentials from the standard chain (env vars, shared config, instance/task role): see the warning below for what that implies for max expiry.

Other SDKs follow the same shape (command/method + params + expiry): Python's `boto3.client("s3").generate_presigned_url(...)`, Go's `PresignClient.PresignGetObject(...)`, etc.

## Maximum expiry depends on the credentials, not the request

This is the part that surprises everyone:

| Signer credential type                            | Effective max expiry                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| IAM user access key (long-lived)                  | 7 days (`604800`s) with SigV4 (AWS Signature Version 4, the request-signing scheme S3 uses)             |
| IAM role assumed via STS (Security Token Service) | The role session's remaining lifetime (default 1 hour, max 12 hours)                                    |
| EC2 instance profile                              | The credentials handed out by the EC2 instance metadata service (IMDS), which rotate within a few hours |
| ECS task role                                     | The task credentials' rotation window (typically 1-6 hours)                                             |
| S3 console                                        | 12 hours, hard cap                                                                                      |

The rule: **a presigned URL dies the moment its underlying credentials die, regardless of `--expires-in`** ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html#PresignedUrl-Expiration)).

> [!warning]- "My URL expired in 1 hour even though I set 7 days"
> You almost certainly signed it from inside [[aws/lambda/index|Lambda]], ECS, or EC2. Those use temporary STS credentials that rotate on the order of minutes to hours. To get a true 7-day URL, sign from an environment with **long-lived IAM user credentials** (a CI runner with stored keys, a local script with `~/.aws/credentials`). For server applications that need 7-day links, the usual workaround is to provision a dedicated IAM user _just for signing_, store its keys in [[aws/secrets-manager|Secrets Manager]], and use those, never the runtime role.

## What permissions the signer needs

The presigned URL inherits the signer's permissions at the moment of signing. Concretely:

- **GET URL**: signer needs `s3:GetObject` on `arn:aws:s3:::bucket/key`.
- **PUT URL**: signer needs `s3:PutObject` on the target key.
- **HEAD URL**: signer needs `s3:GetObject` (yes, head uses the same permission).

If the signer can't do the action, the URL is generated successfully but returns `403 Forbidden` when used. Test by curling the URL yourself before handing it out.

## Locking down what a holder can do

A presigned URL is a **bearer token**: anyone who intercepts it can use it until expiry. Three knobs to limit blast radius:

1. **Set the shortest expiry that works.** A 15-minute upload window for an avatar PUT is fine; 7 days is reckless.
2. **Pin to network paths via bucket policy.** Use `aws:SourceIp` (public endpoints) or `aws:SourceVpce` (VPC endpoints) so the URL only works from your office / your VPC.
3. **Cap signature age via `s3:signatureAge`.** Bucket policy can deny any presigned request whose signature is more than N milliseconds old, regardless of the URL's `X-Amz-Expires` ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html#PresignedUrlUploadObject-LimitCapabilities)):

```json
{
  "Sid": "DenyOldPresignedRequests",
  "Effect": "Deny",
  "Principal": { "AWS": "*" },
  "Action": "s3:*",
  "Resource": "arn:aws:s3:::my-bucket/*",
  "Condition": {
    "NumericGreaterThan": { "s3:signatureAge": "600000" }
  }
}
```

That denies any presigned request whose signature is older than 600,000 ms (10 min), even if the URL was generated for 7 days.

## PUT-URL gotchas

- **Headers signed at generation must match at upload.** If you sign with `Content-Type: image/jpeg`, the client MUST send that exact header on the PUT, or you get `SignatureDoesNotMatch`. Sign no extra headers if the client is a generic browser uploader.
- **Tagging goes in headers, not query params.** When using SDKs, pass `Tagging` as the `x-amz-tagging` header on the upload request, not as a presign parameter ([source](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html#ShareObjectPreSignedURLSDK)).
- **Same-key overwrite.** If the key already exists, the PUT overwrites it. Use unique keys (UUID prefix) if that's not what you want.
- **No size limit enforcement in the URL.** A presigned PUT lets the holder upload up to S3's per-object max (5 TB). To cap upload size, use **POST policies** (browser form-POST uploads governed by a signed JSON policy that can constrain `content-length-range` and other fields) instead of presigned PUTs.

## Common errors and fixes

| Error                     | Likely cause                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `403 Forbidden`           | Signer lacks `s3:GetObject`/`s3:PutObject`, or bucket policy explicitly denies, or S3 Block Public Access (BPA) on the bucket blocks the request as public. |
| `SignatureDoesNotMatch`   | Clock skew on the signing machine; corporate proxy mangling headers; mismatched header on PUT.                                                              |
| `ExpiredToken`            | Signing credentials (STS session) expired between sign and use; refresh credentials and re-sign.                                                            |
| URL "expired" too quickly | Signed by short-lived role credentials; see the warning above.                                                                                              |

## See also

- [[aws/s3/index|S3]] (parent concept).
- [[aws/iam/index|IAM]] (the permissions side of the story).
- [Sharing objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html) (official walkthrough).
- [Uploading objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html) (PUT-side details).
