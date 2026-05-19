import assert from "node:assert/strict"
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
