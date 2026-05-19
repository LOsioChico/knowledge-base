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
import { checkPublishParity } from "./check-publish-parity.mjs"

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url))
const SPLIT_LINE_THRESHOLD = 250
const MDX_CONTENT_PREFIX = "sites/docs/src/content/docs/"

export { REPO_ROOT, SPLIT_LINE_THRESHOLD, MDX_CONTENT_PREFIX }

export function parseVaultCheckArgs(argv) {
  const json = argv.includes("--json")
  const baseIdx = argv.indexOf("--base")
  const baseRef = baseIdx !== -1 ? (argv[baseIdx + 1] ?? null) : "HEAD~1"
  if (baseIdx !== -1 && baseRef === null) {
    throw new Error("--base requires a git ref argument (e.g. --base HEAD~1)")
  }
  return { baseRef, json }
}

/** Paths changed since `ref` (git diff vs working tree: commits after ref + staged + unstaged). */
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

/** Same resolution as mdx-audit-notes `targetsFromBase`. */
export function mdxTargetsFromBase(ref, repoRoot = REPO_ROOT) {
  return changedPathsFromBase(ref, repoRoot)
    .filter((p) => p.startsWith(MDX_CONTENT_PREFIX) && p.endsWith(".mdx"))
    .filter((p) => existsSync(resolve(repoRoot, p)))
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

function formatPass0Block(label, pass0) {
  const lines = []
  if (!pass0) return lines
  const n = pass0.findings ?? 0
  lines.push(
    n === 0
      ? `✓ ${label}: clean`
      : `✗ ${label}: ${n} finding(s) across ${pass0.files ?? 0} file(s)`,
  )
  for (const f of pass0.details ?? []) {
    for (const finding of f.findings) {
      lines.push(`  ${f.path}:${finding.line} [${finding.rule}] ${finding.message}`)
    }
  }
  lines.push("")
  return lines
}

function formatAuditTotalsBlock(label, audit, skipped) {
  const lines = []
  if (skipped) {
    lines.push(`⊘ ${label}: skipped (${skipped})`)
  } else if (audit) {
    const totals = audit.files.reduce(
      (acc, f) => {
        for (const x of f.findings) {
          if (x.tier === "high") acc.high += 1
          else acc.advisory += 1
        }
        return acc
      },
      { high: 0, advisory: 0 },
    )
    lines.push(`${label}: high=${totals.high} advisory=${totals.advisory}`)
  }
  lines.push("")
  return lines
}

export function formatHumanReport(report) {
  const lines = []
  const mdxCount = report.changedMdxFiles?.length ?? 0
  lines.push(
    `vault:check — ${report.changedFiles.length} vault note(s), ${mdxCount} MDX file(s) (base ${report.baseRef})`,
  )
  lines.push("")

  if (report.changedFiles.length === 0) {
    lines.push("No content/**/*.md changes in range.")
    if (mdxCount > 0) {
      lines.push("")
      lines.push("Changed MDX:")
      for (const f of report.changedMdxFiles) lines.push(`  ${f}`)
    }
    lines.push("")
    lines.push(...formatPass0Block("pass-0-mdx (changed MDX)", report.pass0Mdx))
    if (report.docsLint) {
      lines.push(
        report.docsLint.ok
          ? "✓ lint:docs (sites/docs changed): clean"
          : "✗ lint:docs (sites/docs changed): failed (see stderr above)",
      )
      lines.push("")
    }
    lines.push(...formatAuditTotalsBlock("mdx-audit (triage)", report.mdxAudit, report.mdxAuditSkipped))
    if (report.publishParity) {
      lines.push(
        report.publishParity.ok
          ? `✓ publish-parity: ${report.publishParity.vaultCount} vault ↔ ${report.publishParity.mdxCount} MDX`
          : `✗ publish-parity: ${report.publishParity.errors.join("; ")}`,
      )
      lines.push("")
    }
    if (!report.auditSkipped) {
      lines.push(...formatAuditTotalsBlock("vault-audit (triage)", report.audit, null))
    } else if (mdxCount === 0) {
      lines.push(`⊘ vault-audit: skipped (${report.auditSkipped})`)
      lines.push("")
    }
    if (report.suggestions?.length) {
      lines.push(`suggestions (${report.suggestions.length}):`)
      for (const s of report.suggestions) {
        if (s.kind === "link-pair") {
          lines.push(
            `  link-pair ${s.score.toFixed(3)} [[${s.a}]] <-> [[${s.b}]]${s.blocking ? " (blocking)" : ""}`,
          )
        }
      }
    } else {
      lines.push("i suggestions: none")
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

  lines.push(...formatPass0Block("pass-0 (changed vault)", report.pass0))

  if (mdxCount > 0) {
    lines.push("Changed MDX:")
    for (const f of report.changedMdxFiles) lines.push(`  ${f}`)
    lines.push("")
    lines.push(...formatPass0Block("pass-0-mdx (changed MDX)", report.pass0Mdx))
  }

  if (report.docsLint) {
    lines.push(
      report.docsLint.ok
        ? "✓ lint:docs (sites/docs changed): clean"
        : "✗ lint:docs (sites/docs changed): failed (see stderr above)",
    )
    lines.push("")
  }

  lines.push(...formatAuditTotalsBlock("vault-audit (triage)", report.audit, report.auditSkipped))
  lines.push(...formatAuditTotalsBlock("mdx-audit (triage)", report.mdxAudit, report.mdxAuditSkipped))

  if (report.publishParity) {
    lines.push(
      report.publishParity.ok
        ? `✓ publish-parity: ${report.publishParity.vaultCount} vault ↔ ${report.publishParity.mdxCount} MDX`
        : `✗ publish-parity: ${report.publishParity.errors.join("; ")}`,
    )
    lines.push("")
  }

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
  const changedMdxFiles = mdxTargetsFromBase(baseRef, repoRoot)
  const publishParity = checkPublishParity(repoRoot)

  if (changedFiles.length === 0) {
    return {
      baseRef,
      changedFiles,
      changedMdxFiles,
      links: { ok: true, violations: [], warnings: [] },
      suggestions: [],
      pass0: { ok: true, findings: 0, files: 0, details: [] },
      pass0Mdx: null,
      auditSkipped:
        changedMdxFiles.length === 0 ? "no changed content/**/*.md files" : undefined,
      mdxAuditSkipped: undefined,
      publishParity,
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
    changedMdxFiles,
    links,
    suggestions,
    pass0: null,
    pass0Mdx: null,
    audit: undefined,
    auditSkipped: undefined,
    mdxAudit: undefined,
    mdxAuditSkipped: undefined,
    publishParity,
  }
}
