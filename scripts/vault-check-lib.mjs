import { readFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  buildLinkSuggestions,
  filterLintResultForChanged,
  lintVault,
} from "./lint-wikilinks-core.mjs"

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url))
const SPLIT_LINE_THRESHOLD = 250

export { REPO_ROOT, SPLIT_LINE_THRESHOLD }

export function parseVaultCheckArgs(argv) {
  const json = argv.includes("--json")
  const baseIdx = argv.indexOf("--base")
  const baseRef = baseIdx !== -1 ? (argv[baseIdx + 1] ?? null) : "HEAD~1"
  if (baseIdx !== -1 && baseRef === null) {
    throw new Error("--base requires a git ref argument (e.g. --base HEAD~1)")
  }
  return { baseRef, json }
}

/** Paths changed since `ref` (committed diff only; same as audit-notes `targetsFromBase`). */
export function changedPathsFromBase(ref, repoRoot = REPO_ROOT) {
  let raw
  try {
    raw = execFileSync("git", ["diff", "--name-only", ref], {
      cwd: repoRoot,
      encoding: "utf8",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`git diff --name-only ${ref} failed: ${msg}`)
  }
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Same resolution as audit-notes `targetsFromBase`. */
export function targetsFromBase(ref, repoRoot = REPO_ROOT) {
  return changedPathsFromBase(ref, repoRoot)
    .filter((p) => p.startsWith("content/") && p.endsWith(".md"))
    .filter((p) => existsSync(resolve(repoRoot, p)))
}

export function docsPathsChangedFromBase(ref, repoRoot = REPO_ROOT) {
  return changedPathsFromBase(ref, repoRoot).some((p) => p.startsWith("sites/docs/"))
}

export async function runWikilinkPass({ contentRoot, repoRoot, changedFiles }) {
  const full = await lintVault({ contentRoot, repoRoot })
  const links = filterLintResultForChanged(full, changedFiles)
  const suggestions = buildLinkSuggestions(full, changedFiles)
  return { full, links, suggestions }
}

export async function findSplitCandidates(changedFiles, repoRoot = REPO_ROOT) {
  const candidates = []
  for (const file of changedFiles) {
    const abs = resolve(repoRoot, file)
    const content = await readFile(abs, "utf8")
    const lines = content.split("\n").length
    if (lines <= SPLIT_LINE_THRESHOLD) continue
    const sections = []
    for (const line of content.split("\n")) {
      if (/^## /.test(line)) sections.push(line.slice(3).trim())
    }
    candidates.push({
      kind: "split-candidate",
      file,
      lines,
      sections,
    })
  }
  return candidates
}

export function formatHumanReport(report) {
  const lines = []
  lines.push(`vault:check — ${report.changedFiles.length} changed note(s) (base ${report.baseRef})`)
  lines.push("")

  if (report.changedFiles.length === 0) {
    lines.push("No content/**/*.md changes in range.")
    if (report.docsLint) {
      lines.push("")
      lines.push(
        report.docsLint.ok
          ? "✓ lint:docs (sites/docs changed): clean"
          : `✗ lint:docs (sites/docs changed): failed`,
      )
    }
    return lines.join("\n")
  }

  lines.push("Changed:")
  for (const f of report.changedFiles) lines.push(`  ${f}`)
  lines.push("")

  const { links } = report
  lines.push(links.ok ? "✓ wikilinks (scoped): clean" : `✗ wikilinks (scoped): ${links.violations.length} violation(s)`)
  if (!links.ok) {
    for (const v of links.violations.slice(0, 20)) {
      const loc = v.file ? `${v.file}${v.line ? `:${v.line}` : ""}` : v.check
      lines.push(`  ${loc} [${v.check}] ${v.message}`)
    }
    if (links.violations.length > 20) lines.push(`  … and ${links.violations.length - 20} more`)
  }
  if (links.warnings.length > 0) {
    lines.push(`i wikilink warnings (scoped): ${links.warnings.length}`)
  }
  lines.push("")

  if (report.pass0) {
    const n = report.pass0.findings
    lines.push(
      n === 0
        ? "✓ pass-0 (changed files): clean"
        : `✗ pass-0 (changed files): ${n} finding(s) across ${report.pass0.files} file(s)`,
    )
    for (const f of report.pass0.details ?? []) {
      for (const finding of f.findings) {
        lines.push(`  ${f.path}:${finding.line} [${finding.rule}] ${finding.message}`)
      }
    }
    lines.push("")
  }

  if (report.docsLint) {
    lines.push(
      report.docsLint.ok
        ? "✓ lint:docs (sites/docs changed): clean"
        : "✗ lint:docs (sites/docs changed): failed (see stderr above)",
    )
    lines.push("")
  }

  if (report.auditSkipped) {
    lines.push(`⊘ audit: skipped (${report.auditSkipped})`)
  } else if (report.audit) {
    const totals = report.audit.files.reduce(
      (acc, f) => {
        for (const x of f.findings) {
          if (x.tier === "high") acc.high += 1
          else acc.advisory += 1
        }
        return acc
      },
      { high: 0, advisory: 0 },
    )
    lines.push(`audit (triage): high=${totals.high} advisory=${totals.advisory}`)
  }
  lines.push("")

  if (report.suggestions.length === 0) {
    lines.push("i suggestions: none")
  } else {
    lines.push(`suggestions (${report.suggestions.length}):`)
    for (const s of report.suggestions) {
      if (s.kind === "link-pair") {
        lines.push(
          `  link-pair ${s.score.toFixed(3)} [[${s.a}]] <-> [[${s.b}]]${s.blocking ? " (blocking)" : ""}`,
        )
        if (s.sharedTerms?.length) lines.push(`    shared: ${s.sharedTerms.join(", ")}`)
      } else if (s.kind === "first-mention") {
        lines.push(`  first-mention ${s.file}:${s.line} "${s.term}" → [[${s.target}]]`)
      } else if (s.kind === "orphan") {
        lines.push(`  orphan ${s.file}`)
      } else if (s.kind === "split-candidate") {
        lines.push(`  split-candidate ${s.file} (${s.lines} lines, ${s.sections.length} H2)`)
        for (const h of s.sections) lines.push(`    ## ${h}`)
      }
    }
  }

  return lines.join("\n")
}

export async function buildVaultCheckReport({ baseRef, repoRoot = REPO_ROOT }) {
  const contentRoot = join(repoRoot, "content")
  const changedFiles = targetsFromBase(baseRef, repoRoot)

  if (changedFiles.length === 0) {
    return {
      baseRef,
      changedFiles,
      links: { ok: true, violations: [], warnings: [] },
      suggestions: [],
      pass0: { findings: 0, files: 0, details: [] },
      auditSkipped: "no changed content/**/*.md files",
    }
  }

  const { links, suggestions: linkSuggestions } = await runWikilinkPass({
    contentRoot,
    repoRoot,
    changedFiles,
  })
  const splitSuggestions = await findSplitCandidates(changedFiles, repoRoot)
  const suggestions = [...linkSuggestions, ...splitSuggestions]

  return {
    baseRef,
    changedFiles,
    links,
    suggestions,
    pass0: null,
    audit: undefined,
    auditSkipped: undefined,
  }
}
