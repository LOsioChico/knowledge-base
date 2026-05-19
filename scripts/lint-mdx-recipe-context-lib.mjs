// Heuristic checks for recipe MDX: bash fences need teaching prose above them.
// Used by lint-mdx-recipe-context.mjs and tests.

import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const BASH_FENCE_OPEN = /^```(?:bash|sh)\s*$/
const HEADING_RE = /^#{2,6}\s+/
const MIN_EXPLAINER_CHARS = 28

/** @typedef {{ line: number, rule: string, message: string }} RecipeContextFinding */

/**
 * @param {string} text
 * @param {string} relPath repo-relative path
 * @returns {{ isRecipe: boolean, findings: RecipeContextFinding[], compression?: { vaultWords: number, mdxWords: number, ratio: number } }}
 */
export function analyzeMdxRecipeContext(text, relPath) {
  const body = stripFrontmatter(text)
  const bashCount = countBashFences(body)
  const isRecipe = classifyRecipe(body, relPath, bashCount)

  /** @type {RecipeContextFinding[]} */
  const findings = []
  if (!isRecipe) {
    return { isRecipe: false, findings }
  }

  const bodyStartLine = frontmatterLineCount(text)
  const lines = body.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (!BASH_FENCE_OPEN.test(lines[i])) continue

    const lineNo = bodyStartLine + i + 1

    if (orphanBashAfterHeading(lines, i)) {
      findings.push({
        line: lineNo,
        rule: "orphan-bash-after-heading",
        message:
          "Bash fence immediately follows a heading with no explanatory paragraph (add why + what to verify in output).",
      })
      continue
    }

    if (thinContextBeforeBash(lines, i)) {
      findings.push({
        line: lineNo,
        rule: "thin-context-before-bash",
        message:
          "No teaching prose in the lines above this bash fence (need purpose + what field in output to check).",
      })
    }
  }

  return { isRecipe: true, findings }
}

/**
 * @param {string} repoRoot
 * @param {string[]} mdxRelPaths
 * @returns {{ recipeFiles: number, findings: Array<RecipeContextFinding & { file: string }>, ok: boolean }}
 */
export function lintMdxRecipeContext(repoRoot, mdxRelPaths) {
  /** @type {Array<RecipeContextFinding & { file: string }>} */
  const findings = []
  let recipeFiles = 0

  for (const rel of mdxRelPaths) {
    const abs = join(repoRoot, rel)
    if (!existsSync(abs)) continue
    const text = readFileSync(abs, "utf8")
    const result = analyzeMdxRecipeContext(text, rel)
    if (!result.isRecipe) continue
    recipeFiles++
    for (const f of result.findings) {
      findings.push({ file: rel, ...f })
    }
  }

  return { recipeFiles, findings, ok: findings.length === 0 }
}

function stripFrontmatter(text) {
  if (!text.startsWith("---\n")) return text
  const end = text.indexOf("\n---\n", 4)
  if (end === -1) return text
  return text.slice(end + 5)
}

/** 1-based line number where body content starts (line after closing `---`). */
function frontmatterLineCount(text) {
  if (!text.startsWith("---\n")) return 0
  const end = text.indexOf("\n---\n", 4)
  if (end === -1) return 0
  return text.slice(0, end + 5).split("\n").length
}

function countBashFences(body) {
  return (body.match(/^```(?:bash|sh)\s*$/gm) ?? []).length
}

function classifyRecipe(body, relPath, bashCount) {
  if (bashCount < 2) return false
  if (/quickstart\.mdx$/i.test(relPath)) return true
  if (/\/recipes\//.test(relPath)) return true
  if (/cross-account/i.test(relPath)) return true
  if (/^## Before you start/m.test(body)) return true
  if (/^## Recipe overview/m.test(body)) return true
  if (/\| Step \|/i.test(body)) return true
  if (/^## \d+\./m.test(body)) return true
  if (bashCount >= 3 && /snapshot|migration|restore|copy/i.test(relPath)) return true
  return false
}

function prevNonBlankLine(lines, fromIndex) {
  for (let j = fromIndex - 1; j >= 0; j--) {
    const t = lines[j].trim()
    if (t.length > 0) return { line: lines[j], index: j }
  }
  return null
}

function orphanBashAfterHeading(lines, bashLineIndex) {
  const prev = prevNonBlankLine(lines, bashLineIndex)
  if (!prev) return false
  return HEADING_RE.test(prev.line)
}

function thinContextBeforeBash(lines, bashLineIndex) {
  let scanFrom = bashLineIndex - 1
  const prev = prevNonBlankLine(lines, bashLineIndex)
  if (prev?.line.trim() === "```") {
    for (let j = prev.index - 1; j >= 0; j--) {
      const t = lines[j].trim()
      if (t.startsWith("```")) {
        scanFrom = j - 1
        break
      }
    }
  }

  /** @type {string[]} */
  const candidates = []
  for (let j = scanFrom; j >= 0 && candidates.length < 8; j--) {
    const t = lines[j].trim()
    if (t.length === 0) continue
    if (t.startsWith("```")) break
    if (HEADING_RE.test(t)) break
    candidates.push(t)
  }

  return !candidates.some(isExplainerLine)
}

function isExplainerLine(line) {
  if (line.startsWith("```")) return false
  if (/^<[A-Za-z]/.test(line)) return false
  if (/^<\//.test(line)) return false
  if (/^\|/.test(line) && line.endsWith("|")) return false
  if (/^export\s+\w+=/.test(line)) return false
  if (/^import\s+/.test(line)) return false
  if (line.length >= MIN_EXPLAINER_CHARS) return true
  // Short lead-in before a command block ("After X validates data:")
  if (line.length >= 18 && /:$/.test(line) && !line.startsWith("-")) return true
  return false
}

/** @deprecated Use analyzeMdxRecipeContext — vault body comparison removed (`content/` is stale). */
export function analyzeMdxRecipeContextWithRepo(text, relPath, _repoRoot) {
  return analyzeMdxRecipeContext(text, relPath)
}
