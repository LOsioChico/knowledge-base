import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { join, dirname } from "node:path"

import { checkPublishParity } from "./check-publish-parity.mjs"

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

test("checkPublishParity passes on this repo", () => {
  const result = checkPublishParity(REPO_ROOT)
  assert.equal(result.ok, true, result.errors?.join("; "))
  assert.equal(result.vaultCount, result.mdxCount)
  assert.ok(result.vaultCount >= 80)
})

test("checkPublishParity reports vault-only and mdx-only slugs", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "publish-parity-"))
  await mkdir(join(repoRoot, "content/aws"), { recursive: true })
  await mkdir(join(repoRoot, "sites/docs/src/content/docs/aws"), { recursive: true })
  await writeFile(join(repoRoot, "content/aws/vault-only.md"), "---\ntitle: Vault only\n---\n")
  await writeFile(join(repoRoot, "content/inbox.md"), "---\ntitle: Inbox\n---\n")
  await writeFile(join(repoRoot, "sites/docs/src/content/docs/aws/mdx-only.mdx"), "---\ntitle: MDX only\n---\n")

  const result = checkPublishParity(repoRoot)

  assert.equal(result.ok, false)
  assert.deepEqual(result.errors, [
    "vault notes without MDX (1): aws/vault-only",
    "MDX without vault note (1): aws/mdx-only",
  ])
  assert.equal(result.vaultCount, 1)
  assert.equal(result.mdxCount, 1)
})
