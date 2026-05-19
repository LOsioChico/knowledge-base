#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { join } from "node:path"

import {
  REPO_ROOT,
  buildVaultCheckReport,
  docsPathsChangedFromBase,
  formatHumanReport,
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

function runPass0Targets(changedFiles) {
  const pass0Script = join(REPO_ROOT, "scripts/audit-notes/pass0-targets.ts")
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
      error: "pass0-targets returned non-JSON stdout",
    }
  }
}

function runAuditTriage(changedFiles) {
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
    return { error: result.stderr?.trim() || "audit failed to start" }
  }
  if (!result.stdout?.trim()) {
    return { error: "audit returned empty stdout", exitCode: result.status ?? 1 }
  }
  try {
    return {
      audit: JSON.parse(result.stdout.trim()),
      exitCode: result.status ?? 1,
    }
  } catch {
    return { error: "audit returned non-JSON stdout", exitCode: result.status ?? 1 }
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
  const docsChanged = docsPathsChangedFromBase(args.baseRef)

  if (
    report.changedFiles.length === 0 &&
    docsChanged &&
    report.auditSkipped?.startsWith("no changed content")
  ) {
    report.auditSkipped =
      "no changed content/**/*.md files (lint:docs ran because sites/docs/ changed)"
  }

  if (docsChanged) {
    report.docsLint = runDocsLint()
    if (!report.docsLint.ok && !args.json) {
      if (report.docsLint.stdout) process.stdout.write(report.docsLint.stdout)
      if (report.docsLint.stderr) process.stderr.write(report.docsLint.stderr)
    }
  }

  report.pass0 =
    report.changedFiles.length > 0
      ? runPass0Targets(report.changedFiles)
      : { ok: true, findings: 0, files: 0, details: [] }

  const apiKey = process.env.CURSOR_API_KEY ?? ""
  if (apiKey === "") {
    report.auditSkipped =
      "CURSOR_API_KEY not set (skipped triage audit; set key for source verification)"
  } else if (report.changedFiles.length > 0) {
    const auditResult = runAuditTriage(report.changedFiles)
    if (auditResult.error) {
      report.auditSkipped = auditResult.error
    } else {
      report.audit = auditResult.audit
      report.auditExitCode = auditResult.exitCode
    }
  }

  let exitCode = 0
  if (!report.links.ok) exitCode = 1
  if (report.docsLint && !report.docsLint.ok) exitCode = 1
  if (report.pass0 && !report.pass0.ok) exitCode = 1
  if (report.auditExitCode === 1) exitCode = 1

  if (args.json) {
    const out = {
      audit: report.audit,
      links: report.links,
      suggestions: report.suggestions,
      baseRef: report.baseRef,
      changedFiles: report.changedFiles,
      pass0: report.pass0,
      auditSkipped: report.auditSkipped,
      docsLint: report.docsLint,
    }
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`)
  } else {
    process.stdout.write(`${formatHumanReport(report)}\n`)
    if (report.auditSkipped) {
      process.stderr.write(`\n${report.auditSkipped}\n`)
    }
  }

  process.exit(exitCode > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("vault:check failed:", err)
  process.exit(2)
})
