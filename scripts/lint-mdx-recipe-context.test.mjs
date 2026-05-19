import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  analyzeMdxRecipeContext,
  analyzeMdxRecipeContextWithRepo,
} from "./lint-mdx-recipe-context-lib.mjs"

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const GOLD_MDX =
  "sites/docs/src/content/docs/aws/rds/cross-account-snapshot.mdx"

test("gold recipe: cross-account-snapshot has no orphan or thin-context bash findings", () => {
  const text = readFileSync(join(REPO_ROOT, GOLD_MDX), "utf8")
  const { isRecipe, findings } = analyzeMdxRecipeContext(text, GOLD_MDX)
  assert.equal(isRecipe, true)

  const structural = findings.filter(
    (f) =>
      f.rule === "orphan-bash-after-heading" ||
      f.rule === "thin-context-before-bash",
  )
  assert.equal(
    structural.length,
    0,
    structural.map((f) => `L${f.line} ${f.rule}: ${f.message}`).join("\n"),
  )
})

test("S3 cross-account migration has context before bash (regression)", () => {
  const rel = "sites/docs/src/content/docs/aws/s3/cross-account-migration.mdx"
  const text = readFileSync(join(REPO_ROOT, rel), "utf8")
  const { isRecipe, findings } = analyzeMdxRecipeContext(text, rel)
  assert.equal(isRecipe, true)
  const structural = findings.filter(
    (f) =>
      f.rule === "orphan-bash-after-heading" ||
      f.rule === "thin-context-before-bash",
  )
  assert.equal(
    structural.length,
    0,
    structural.map((f) => `L${f.line} ${f.rule}`).join("\n"),
  )
})

test("--strict exits 0 when structural recipe context is clean", async () => {
  const { spawnSync } = await import("node:child_process")
  const r = spawnSync(
    process.execPath,
    ["scripts/lint-mdx-recipe-context.mjs", "--strict"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  )
  assert.equal(r.status, 0, r.stderr || r.stdout)
})

test("detects orphan bash immediately after heading", () => {
  const body = `---
title: Bad
description: x
---

## 1. Pre-flight

\`\`\`bash
aws sts get-caller-identity --profile account-a
\`\`\`

## 2. Also bad

\`\`\`bash
aws s3 ls
\`\`\`
`
  const rel = "sites/docs/src/content/docs/aws/foo/quickstart.mdx"
  const { isRecipe, findings } = analyzeMdxRecipeContext(body, rel)
  assert.equal(isRecipe, true)
  assert.ok(
    findings.some((f) => f.rule === "orphan-bash-after-heading"),
    "expected orphan-bash-after-heading",
  )
})

test("detects thin context when only short lines precede bash", () => {
  const body = `---
title: Bad
description: x
---

## Before you start

- Profiles ready

\`\`\`bash
aws s3 ls
\`\`\`

Long explanation of why you run this command and what Account field in JSON output must match your placeholder before the next block.

\`\`\`bash
aws sts get-caller-identity
\`\`\`
`
  const rel = "sites/docs/src/content/docs/aws/foo/quickstart.mdx"
  const { findings } = analyzeMdxRecipeContext(body, rel)
  const firstBash = findings.filter((f) => f.rule === "thin-context-before-bash")
  assert.ok(firstBash.length >= 1, "first bash should lack explainer")
})

test("does not compare MDX length to stale content/ vault", () => {
  const mdxText = readFileSync(join(REPO_ROOT, GOLD_MDX), "utf8")
  const { findings } = analyzeMdxRecipeContextWithRepo(
    mdxText,
    GOLD_MDX,
    REPO_ROOT,
  )
  assert.equal(
    findings.filter((f) => f.rule === "vault-compression").length,
    0,
    "vault-compression rule removed",
  )
})
