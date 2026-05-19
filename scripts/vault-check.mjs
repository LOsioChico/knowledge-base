#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { join } from "node:path"

import {
  REPO_ROOT,
  buildVaultCheckReport,
  docsPathsChangedFromBase,
  formatHumanReport,
  mdxTargetsFromBase,
  parseVaultCheckArgs,
} from "./vault-check-lib.mjs"

function runDocsLint() {
  const result = spawnSync("bun", ["run", "lint:docs"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: process.env,
  })
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

function runPass0Json(scriptName, changedFiles) {
  if (changedFiles.length === 0) {
    return { ok: true, findings: 0, files: 0, details: [] }
  }
  const pass0Script = join(REPO_ROOT, "scripts/audit-notes", scriptName)
  const result = spawnSync("npx", ["tsx", pass0Script, "--json", ...changedFiles], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: process.env,
  })
  if (!result.stdout?.trim()) {
    return {
      ok: result.status === 0,
      findings: 0,
      files: 0,
      details: [],
      error: result.stderr?.trim(),
    }
  }
  try {
    const parsed = JSON.parse(result.stdout.trim())
    return {
      ok: parsed.ok === true,
      findings: parsed.findings ?? 0,
      files: parsed.files ?? 0,
      details: parsed.details ?? [],
    }
  } catch {
    return {
      ok: false,
      findings: 0,
      files: 0,
      details: [],
      error: `${scriptName} returned non-JSON stdout`,
    }
  }
}

function runVaultAuditTriage(changedFiles) {
  const auditScript = join(REPO_ROOT, "scripts/audit-notes/audit-notes.ts")
  const result = spawnSync(
    "npx",
    ["tsx", auditScript, "--profile", "triage", "--json", ...changedFiles],
    {
      cwd: join(REPO_ROOT, "scripts/audit-notes"),
      encoding: "utf8",
      env: process.env,
    },
  )
  if (result.status === 2) {
    return { error: result.stderr?.trim() || "vault audit failed to start" }
  }
  if (!result.stdout?.trim()) {
    return { error: "vault audit returned empty stdout", exitCode: result.status ?? 1 }
  }
  try {
    return {
      audit: JSON.parse(result.stdout.trim()),
      exitCode: result.status ?? 1,
    }
  } catch {
    return { error: "vault audit returned non-JSON stdout", exitCode: result.status ?? 1 }
  }
}

function runMdxAuditTriage(changedMdxFiles) {
  const auditScript = join(REPO_ROOT, "scripts/audit-notes/mdx-audit-notes.ts")
  const result = spawnSync(
    "npx",
    ["tsx", auditScript, "--profile", "mdx-triage", "--json", ...changedMdxFiles],
    {
      cwd: join(REPO_ROOT, "scripts/audit-notes"),
      encoding: "utf8",
      env: process.env,
    },
  )
  if (result.status === 2) {
    return { error: result.stderr?.trim() || "mdx audit failed to start" }
  }
  if (!result.stdout?.trim()) {
    return { error: "mdx audit returned empty stdout", exitCode: result.status ?? 1 }
  }
  try {
    return {
      audit: JSON.parse(result.stdout.trim()),
      exitCode: result.status ?? 1,
    }
  } catch {
    return { error: "mdx audit returned non-JSON stdout", exitCode: result.status ?? 1 }
  }
}

async function main() {
  let args
  try {
    args = parseVaultCheckArgs(process.argv.slice(2))
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }

  const report = await buildVaultCheckReport({ baseRef: args.baseRef })
  const changedMdxFiles =
    report.changedMdxFiles ?? mdxTargetsFromBase(args.baseRef)
  report.changedMdxFiles = changedMdxFiles

  const docsChanged = docsPathsChangedFromBase(args.baseRef)

  if (docsChanged) {
    report.docsLint = runDocsLint()
    if (!report.docsLint.ok && !args.json) {
      if (report.docsLint.stdout) process.stdout.write(report.docsLint.stdout)
      if (report.docsLint.stderr) process.stderr.write(report.docsLint.stderr)
    }
  }

  report.pass0 =
    report.changedFiles.length > 0
      ? runPass0Json("pass0-targets.ts", report.changedFiles)
      : { ok: true, findings: 0, files: 0, details: [] }

  report.pass0Mdx =
    changedMdxFiles.length > 0
      ? runPass0Json("pass0-mdx-targets.ts", changedMdxFiles)
      : { ok: true, findings: 0, files: 0, details: [] }

  const apiKey = process.env.CURSOR_API_KEY ?? ""

  if (apiKey === "") {
    if (report.changedFiles.length > 0) {
      report.auditSkipped =
        "CURSOR_API_KEY not set (skipped vault triage; set key for source verification)"
    }
    if (changedMdxFiles.length > 0) {
      report.mdxAuditSkipped =
        "CURSOR_API_KEY not set (skipped mdx-triage; set key for kb-mdx-auditor)"
    }
  } else {
    if (report.changedFiles.length > 0) {
      const vaultAudit = runVaultAuditTriage(report.changedFiles)
      if (vaultAudit.error) {
        report.auditSkipped = vaultAudit.error
      } else {
        report.audit = vaultAudit.audit
        report.auditExitCode = vaultAudit.exitCode
      }
    }

    if (changedMdxFiles.length > 0) {
      const mdxAudit = runMdxAuditTriage(changedMdxFiles)
      if (mdxAudit.error) {
        report.mdxAuditSkipped = mdxAudit.error
      } else {
        report.mdxAudit = mdxAudit.audit
        report.mdxAuditExitCode = mdxAudit.exitCode
      }
    }
  }

  let exitCode = 0
  if (!report.links.ok) exitCode = 1
  if (report.publishParity && !report.publishParity.ok) exitCode = 1
  if (report.docsLint && !report.docsLint.ok) exitCode = 1
  if (report.pass0 && !report.pass0.ok) exitCode = 1
  if (report.pass0Mdx && !report.pass0Mdx.ok) exitCode = 1
  if (report.auditExitCode === 1) exitCode = 1
  if (report.mdxAuditExitCode === 1) exitCode = 1

  if (args.json) {
    const out = {
      audit: report.audit,
      mdxAudit: report.mdxAudit,
      links: report.links,
      suggestions: report.suggestions,
      baseRef: report.baseRef,
      changedFiles: report.changedFiles,
      changedMdxFiles: report.changedMdxFiles,
      pass0: report.pass0,
      pass0Mdx: report.pass0Mdx,
      auditSkipped: report.auditSkipped,
      mdxAuditSkipped: report.mdxAuditSkipped,
      docsLint: report.docsLint,
      publishParity: report.publishParity,
    }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  } else {
    process.stdout.write(`${formatHumanReport(report)}\n`)
    const skipped = [report.auditSkipped, report.mdxAuditSkipped].filter(Boolean)
    if (skipped.length > 0) {
      process.stderr.write(`\n${skipped.join("\n")}\n`)
    }
  }

  process.exit(exitCode > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("vault:check failed:", err)
  process.exit(2)
})
