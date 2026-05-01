// Deterministic post-filter for LLM auditor findings.
//
// Goal: drop the two structural false-positive patterns we observed in the
// validation runs, BEFORE Pass 2 (verifier) sees them. This is cheaper and
// more reliable than asking Composer-2-as-judge to recognize the patterns.
//
// Filters:
//   1. table-link: keep only if the cited line's first markdown-table column
//      starts with a backtick-wrapped identifier (`Word`, `Word.method`,
//      `@Decorator`). Drops behavioral-comparison tables whose first column
//      is a signature pattern (e.g. `@Body() dto: CreateUserDto`).
//   2. code-imports: drop if the snippet sits inside an !example / !info /
//      !tip callout AND the offending symbol is a framework wiring
//      (`app`, `module`, `bootstrap`). Mirrors audit A's
//      "single-line illustrative fragments in unambiguous context" carve-out.
//
// Both filters are conservative: when in doubt, keep the finding. Pass 2
// gets the last word.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FlatFinding } from "./types.js";

const REPO_ROOT_ENV: string = process.env["AUDIT_REPO_ROOT"] ?? "";

const NAMED_ENTITY_RE: RegExp = /^\s*\|\s*`(@?[A-Z_][\w.]*)`/;
const FRAMEWORK_WIRINGS: ReadonlySet<string> = new Set([
  "app",
  "module",
  "bootstrap",
]);
const CALLOUT_OPEN_RE: RegExp = /^\s*>\s*\[!(example|info|tip)\][-+]?/i;

interface FileLines {
  lines: readonly string[];
}

function loadFile(repoRoot: string, repoRelPath: string): FileLines {
  const abs: string = resolve(repoRoot, repoRelPath);
  const text: string = readFileSync(abs, "utf8");
  return { lines: text.split("\n") };
}

function keepTableLink(
  finding: FlatFinding,
  file: FileLines,
): { keep: boolean; reason: string } {
  const idx: number = finding.line - 1;
  const line: string | undefined = file.lines[idx];
  if (line === undefined) return { keep: false, reason: "line out of range" };
  if (!NAMED_ENTITY_RE.test(line)) {
    return {
      keep: false,
      reason: "first table column is not a named entity (signature pattern)",
    };
  }
  return { keep: true, reason: "" };
}

function keepCodeImports(
  finding: FlatFinding,
  file: FileLines,
): { keep: boolean; reason: string } {
  const idx: number = finding.line - 1;
  // Walk upward at most 30 lines to find the enclosing callout opener (if any).
  let inCallout: boolean = false;
  for (let i: number = idx; i >= Math.max(0, idx - 30); i--) {
    const ln: string | undefined = file.lines[i];
    if (ln === undefined) continue;
    // Stop if we hit a non-callout, non-code-fence top-level line.
    if (CALLOUT_OPEN_RE.test(ln)) {
      inCallout = true;
      break;
    }
    // Lines inside a callout start with `>`. A line that does NOT start with `>`
    // and is not blank means we've left the callout walking up.
    if (!ln.startsWith(">") && ln.trim() !== "") break;
  }
  if (!inCallout) return { keep: true, reason: "" };
  // Inside a callout. Check whether the offending evidence references only
  // framework wirings.
  const evidence: string = (finding.evidence ?? "").toLowerCase();
  if (evidence === "") return { keep: true, reason: "" }; // can't verify; keep
  // Tokenize identifiers from the evidence and check whether ALL undefined-
  // looking ones are framework wirings. We can't easily know which symbols
  // were the "undefined" ones without re-running the LLM, but the auditor's
  // evidence usually quotes the offending call site (e.g. `app.useGlobalPipes(`).
  const tokens: ReadonlyArray<string> = Array.from(
    evidence.matchAll(/[a-z_][\w]*/gi),
  ).map((m) => (m[0] ?? "").toLowerCase());
  if (tokens.length === 0) return { keep: true, reason: "" };
  const allFramework: boolean = tokens.every((t: string): boolean =>
    FRAMEWORK_WIRINGS.has(t),
  );
  if (allFramework) {
    return {
      keep: false,
      reason:
        "snippet inside !example/!info/!tip callout; only framework wirings (app/module/bootstrap) referenced \u2014 audit A illustrative-fragment exemption",
    };
  }
  return { keep: true, reason: "" };
}

export interface PostFilterResult {
  kept: FlatFinding[];
  dropped: Array<{ finding: FlatFinding; reason: string }>;
}

export function postFilter(
  repoRoot: string,
  findings: readonly FlatFinding[],
): PostFilterResult {
  const fileCache: Map<string, FileLines> = new Map();
  const kept: FlatFinding[] = [];
  const dropped: Array<{ finding: FlatFinding; reason: string }> = [];
  for (const f of findings) {
    let file: FileLines | undefined = fileCache.get(f.path);
    if (file === undefined) {
      try {
        file = loadFile(repoRoot, f.path);
      } catch {
        kept.push(f);
        continue;
      }
      fileCache.set(f.path, file);
    }
    let decision: { keep: boolean; reason: string };
    if (f.rule === "table-link") {
      decision = keepTableLink(f, file);
    } else if (f.rule === "code-imports") {
      decision = keepCodeImports(f, file);
    } else {
      decision = { keep: true, reason: "" };
    }
    if (decision.keep) kept.push(f);
    else dropped.push({ finding: f, reason: decision.reason });
  }
  // Quiet a lint complaint about the env var being read but not used elsewhere.
  void REPO_ROOT_ENV;
  return { kept, dropped };
}
