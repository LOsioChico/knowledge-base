import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { buildLinkSuggestions } from "./lint-wikilinks-core.mjs"
import {
  findSplitCandidates,
  parseVaultCheckArgs,
  SPLIT_LINE_THRESHOLD,
} from "./vault-check-lib.mjs"

test("parseVaultCheckArgs defaults base to HEAD~1", () => {
  const args = parseVaultCheckArgs([])
  assert.equal(args.baseRef, "HEAD~1")
  assert.equal(args.json, false)
})

test("parseVaultCheckArgs reads --base and --json", () => {
  const args = parseVaultCheckArgs(["--json", "--base", "origin/main"])
  assert.equal(args.baseRef, "origin/main")
  assert.equal(args.json, true)
})

test("parseVaultCheckArgs rejects bare --base", () => {
  assert.throws(() => parseVaultCheckArgs(["--base"]), /requires a git ref/)
})

test("findSplitCandidates flags long notes with H2 headings", async () => {
  const repoRoot = await mkdtemp(join(tmpdir(), "vault-check-"))
  const file = "content/nestjs/recipes/big-note.md"
  const body = ["---", "title: Big", "tags: [type/recipe]", "area: nestjs", "status: evergreen", "related: []", "---", ">", "Tagline.", ""]
  for (let i = 0; i < SPLIT_LINE_THRESHOLD; i++) body.push(`line ${i}`)
  body.push("## First section", "content", "## Second section", "more")
  await mkdir(join(repoRoot, "content/nestjs/recipes"), { recursive: true })
  await writeFile(join(repoRoot, file), body.join("\n"))

  const candidates = await findSplitCandidates([file], repoRoot)
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].kind, "split-candidate")
  assert.equal(candidates[0].file, file)
  assert.ok(candidates[0].lines > SPLIT_LINE_THRESHOLD)
  assert.deepEqual(candidates[0].sections, ["First section", "Second section"])
})

test("buildLinkSuggestions includes discoverability pairs for changed files", () => {
  const lintResult = {
    violations: [
      {
        check: "discoverability",
        a: "nestjs/a",
        b: "nestjs/b",
        score: 0.21,
        sharedTerms: ["pipe"],
        suggestedActions: ["related-both-ways"],
        severity: "decision",
      },
    ],
    warnings: [
      {
        check: "discoverability-advisory",
        a: "nestjs/c",
        b: "nestjs/d",
        score: 0.17,
        sharedTerms: ["guard"],
        severity: "warning",
      },
    ],
  }
  const suggestions = buildLinkSuggestions(lintResult, [
    "content/nestjs/a.md",
    "content/nestjs/c.md",
  ])
  assert.equal(suggestions.length, 2)
  const blocking = suggestions.find((s) => s.a === "nestjs/a")
  const advisory = suggestions.find((s) => s.a === "nestjs/c")
  assert.equal(blocking?.kind, "link-pair")
  assert.equal(blocking?.blocking, true)
  assert.equal(advisory?.blocking, false)
})
