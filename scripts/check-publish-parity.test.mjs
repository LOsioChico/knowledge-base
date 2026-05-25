import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { checkPublishParity } from "./check-publish-parity.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("checkPublishParity passes on this repo", () => {
  const result = checkPublishParity(REPO_ROOT);
  assert.equal(result.ok, true, result.errors?.join("; "));
  assert.ok(result.mdxCount >= 80, `expected >=80 MDX pages, got ${result.mdxCount}`);
  assert.equal(result.vaultCount, 0, "vault is fully migrated, vaultCount must be 0");
});

test("checkPublishParity counts MDX pages correctly", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "publish-parity-"));
  await mkdir(join(repoRoot, "sites/docs/src/content/docs/aws"), { recursive: true });
  await writeFile(
    join(repoRoot, "sites/docs/src/content/docs/aws/s3.mdx"),
    "---\ntitle: S3\n---\n",
  );
  await writeFile(
    join(repoRoot, "sites/docs/src/content/docs/aws/ec2.mdx"),
    "---\ntitle: EC2\n---\n",
  );

  const result = checkPublishParity(repoRoot);

  assert.equal(result.ok, true);
  assert.equal(result.vaultCount, 0);
  assert.equal(result.mdxCount, 2);
  assert.equal(result.mdxOnlyCount, 2);
  assert.deepEqual(result.mdxOnly, ["aws/ec2", "aws/s3"]);
});

test("checkPublishParity fails when MDX root is missing", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "publish-parity-"));
  const result = checkPublishParity(repoRoot);
  assert.equal(result.ok, false);
  assert.ok(result.errors[0].includes("missing"));
});
