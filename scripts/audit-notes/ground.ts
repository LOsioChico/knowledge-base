// Span grounding (technique C from the precision plan).
//
// Drops any LLM finding whose `evidence` quote is not a verbatim substring of
// the cited file within ±N lines of the cited `line`. This kills the most
// common verifier-hallucination FP shape: a plausible-looking quote that the
// model fabricated because the cited line was a delimiter or boundary.
//
// Findings without an `evidence` field are kept (we have no quote to verify).
// Findings whose evidence is found anywhere within the window are kept.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FlatFinding } from "./types.js";

export interface GroundResult {
  kept: FlatFinding[];
  dropped: FlatFinding[];
}

function normalize(s: string): string {
  // Collapse runs of whitespace; trim. Markdown often line-wraps mid-sentence
  // and the model returns the unwrapped form.
  return s.replace(/\s+/g, " ").trim();
}

export function groundFindings(
  repoRoot: string,
  findings: readonly FlatFinding[],
  windowLines: number,
): GroundResult {
  const fileCache: Map<string, string[]> = new Map();
  const kept: FlatFinding[] = [];
  const dropped: FlatFinding[] = [];

  for (const f of findings) {
    const evidence: string | undefined = f.evidence;
    if (evidence === undefined || evidence.trim() === "") {
      kept.push(f);
      continue;
    }
    let lines: string[] | undefined = fileCache.get(f.path);
    if (lines === undefined) {
      try {
        lines = readFileSync(resolve(repoRoot, f.path), "utf8").split("\n");
      } catch {
        lines = [];
      }
      fileCache.set(f.path, lines);
    }
    if (lines.length === 0) {
      // Can't verify; conservatively keep.
      kept.push(f);
      continue;
    }
    const start: number = Math.max(0, f.line - 1 - windowLines);
    const end: number = Math.min(lines.length, f.line - 1 + windowLines + 1);
    const window: string = normalize(lines.slice(start, end).join(" "));
    const needle: string = normalize(evidence);
    // Trim trailing markdown/regex noise that the model often appends.
    const needleCore: string =
      needle.length > 16
        ? needle.slice(0, Math.min(needle.length, 80))
        : needle;
    if (
      window.includes(needle) ||
      window.includes(needleCore) ||
      window.includes(needle.slice(0, 24))
    ) {
      kept.push(f);
    } else {
      dropped.push(f);
    }
  }
  return { kept, dropped };
}
