#!/usr/bin/env -S npx tsx
// Pass-0 runner scoped to explicit file paths (repo-relative under content/).
// Used by vault:check for changed-file linting without walking the full vault.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runDeterministic } from "./deterministic.js";
import type { FileReport } from "./types.js";

const REPO_ROOT: string = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);

function main(): void {
  const argv: string[] = process.argv.slice(2);
  const jsonOnly: boolean = argv.includes("--json");
  const paths: string[] = argv.filter(
    (p: string): boolean => p.length > 0 && !p.startsWith("--"),
  );

  if (paths.length === 0) {
    if (jsonOnly) {
      process.stdout.write(
        JSON.stringify({ ok: true, findings: 0, files: [], details: [] }) + "\n",
      );
    } else {
      console.log("pass-0-targets: 0 files (clean)");
    }
    process.exit(0);
  }

  const reports: FileReport[] = [];
  for (const rel of paths) {
    const abs: string = resolve(REPO_ROOT, rel);
    if (!existsSync(abs)) {
      console.error(`error: file not found: ${rel}`);
      process.exit(2);
    }
    reports.push(runDeterministic(abs, rel));
  }

  const dirty: FileReport[] = reports.filter(
    (r: FileReport): boolean => r.findings.length > 0,
  );
  const totalFindings: number = dirty.reduce(
    (n: number, r: FileReport): number => n + r.findings.length,
    0,
  );

  if (jsonOnly) {
    process.stdout.write(
      JSON.stringify({
        ok: totalFindings === 0,
        findings: totalFindings,
        files: dirty.length,
        details: dirty,
      }) + "\n",
    );
    process.exit(totalFindings === 0 ? 0 : 1);
  }

  if (dirty.length === 0) {
    console.log(`pass-0-targets: ${paths.length} file(s) clean`);
    process.exit(0);
  }

  console.error(
    `pass-0-targets: ${totalFindings} finding(s) across ${dirty.length} file(s)`,
  );
  for (const file of dirty) {
    console.error(`\n${file.path}`);
    for (const f of file.findings) {
      const evidence: string =
        f.evidence !== undefined ? `  | ${f.evidence}` : "";
      console.error(`  ${f.line}:${f.rule}: ${f.message}${evidence}`);
    }
  }
  process.exit(1);
}

main();
