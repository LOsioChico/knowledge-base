#!/usr/bin/env -S npx tsx
// Pass-0 only runner. Walks every .md under content/ and runs the deterministic
// checks (style + frontmatter). No LLM. Exits 1 if any findings, 0 if clean.
//
// Used as a blocking CI gate alongside `npm run lint:wikilinks`.

import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runDeterministic } from "./deterministic.js";
import type { FileReport, Finding } from "./types.js";

const REPO_ROOT: string = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const CONTENT_ROOT: string = join(REPO_ROOT, "content");

function walkMarkdown(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full: string = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkMarkdown(full, out);
    else if (st.isFile() && entry.endsWith(".md")) out.push(full);
  }
}

function main(): void {
  const files: string[] = [];
  walkMarkdown(CONTENT_ROOT, files);
  files.sort();

  const reports: FileReport[] = files.map(
    (abs: string): FileReport =>
      runDeterministic(abs, relative(REPO_ROOT, abs)),
  );
  const dirty: FileReport[] = reports.filter(
    (r: FileReport): boolean => r.findings.length > 0,
  );
  const totalFindings: number = dirty.reduce(
    (n: number, r: FileReport): number => n + r.findings.length,
    0,
  );

  if (dirty.length === 0) {
    console.log(`pass-0: ${files.length} files clean`);
    process.exit(0);
  }

  console.error(
    `pass-0: ${totalFindings} finding(s) across ${dirty.length} file(s)`,
  );
  for (const file of dirty) {
    console.error(`\n${file.path}`);
    for (const f of file.findings as Finding[]) {
      const evidence: string =
        f.evidence !== undefined ? `  | ${f.evidence}` : "";
      console.error(`  ${f.line}:${f.rule}: ${f.message}${evidence}`);
    }
  }
  process.exit(1);
}

main();
