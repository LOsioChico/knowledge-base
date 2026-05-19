#!/usr/bin/env node
// Cross-account recipes declare CLI profiles `account-a` / `account-b`.
// Fail when the same file uses bare "A" / "B" in markdown table Account columns
// (common MDX condensation bug).

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url))
const ROOTS = [
  join(REPO_ROOT, "sites/docs/src/content/docs/aws"),
  join(REPO_ROOT, "content/aws"),
]

/** @type {Array<{ file: string, line: number, text: string }>} */
const violations = []

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.mdx?$/.test(name)) out.push(path)
  }
}

// | 1 | A | action  or  | Account A | ...
const TABLE_ACCOUNT_AB =
  /^\|[^|\n]*\|\s*([0-9]+|Step)\s*\|\s*(A|B)\s*\|/i

function checkFile(abs) {
  const rel = relative(REPO_ROOT, abs)
  const text = readFileSync(abs, "utf8")
  if (!/Profiles:\s*`account-a`/.test(text)) return

  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!TABLE_ACCOUNT_AB.test(line)) continue
    // Allow header rows
    if (/^\|\s*Step\s*\|/i.test(line) || /^\|\s*---/.test(line)) continue
    violations.push({ file: rel, line: i + 1, text: line.trim() })
  }
}

const files = []
for (const root of ROOTS) walk(root, files)
for (const f of files) checkFile(f)

if (violations.length === 0) {
  console.log(`✓ aws profile/table consistency: ${files.length} file(s) checked`)
  process.exit(0)
}

console.error(
  `✗ aws profile/table consistency: ${violations.length} row(s) use bare A/B but file declares account-a/account-b profiles`,
)
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ${v.text}`)
}
process.exit(1)
