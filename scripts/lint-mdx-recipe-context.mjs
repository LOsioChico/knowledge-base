#!/usr/bin/env node
// Recipe MDX: bash fences need teaching prose (why + what to verify).
// Default: advisory (exit 0, print findings). Use --strict to fail CI.

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { analyzeMdxRecipeContext } from "./lint-mdx-recipe-context-lib.mjs"

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url))
const MDX_ROOT = join(REPO_ROOT, "sites/docs/src/content/docs")
const STRICT = process.argv.includes("--strict")
const STRUCTURAL_RULES = new Set([
  "orphan-bash-after-heading",
  "thin-context-before-bash",
])

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (name.endsWith(".mdx")) out.push(path)
  }
}

const absFiles = []
walk(MDX_ROOT, absFiles)
const relFiles = absFiles.map((p) => relative(REPO_ROOT, p))

/** @type {Array<{ file: string, line: number, rule: string, message: string }>} */
const allFindings = []
let recipeFiles = 0

for (const rel of relFiles) {
  const text = readFileSync(join(REPO_ROOT, rel), "utf8")
  const result = analyzeMdxRecipeContext(text, rel)
  if (!result.isRecipe) continue
  recipeFiles++
  for (const f of result.findings) {
    allFindings.push({ file: rel, ...f })
  }
}

const structuralFindings = allFindings.filter((f) =>
  STRUCTURAL_RULES.has(f.rule),
)

if (allFindings.length === 0) {
  console.log(
    `✓ mdx recipe context: ${relFiles.length} MDX file(s), ${recipeFiles} recipe(s), no issues`,
  )
  process.exit(0)
}

const byRule = /** @type {Record<string, number>} */ ({})
for (const f of allFindings) {
  byRule[f.rule] = (byRule[f.rule] ?? 0) + 1
}
const summary = Object.entries(byRule)
  .map(([k, n]) => `${k}=${n}`)
  .join(", ")

const prefix =
  STRICT && structuralFindings.length > 0 ? "✗" : "⚠"
console.error(
  `${prefix} mdx recipe context (${STRICT ? "strict: structural only" : "advisory"}): ${allFindings.length} finding(s) in ${recipeFiles} recipe(s) [${summary}]`,
)

for (const f of allFindings) {
  console.error(`  ${f.file}:${f.line}  [${f.rule}] ${f.message}`)
}

if (STRICT) {
  process.exit(structuralFindings.length === 0 ? 0 : 1)
}

console.log(
  `(advisory — exit 0; use --strict to fail on orphan/thin bash only)`,
)
process.exit(0)
