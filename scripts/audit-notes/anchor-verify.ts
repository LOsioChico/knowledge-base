// Deterministic anchor verifier.
//
// Drops `source-verification` findings whose only complaint is that a
// GitHub `#L<a>-L<b>` line anchor cited in the note is wrong, when the
// anchor is in fact correct.
//
// Empirical motivation: the LLM source verifier reports "real range is
// L<m>-L<n>" with high false-positive rate (~50% in one batch: it pattern-
// matches on a nearby symbol or hallucinates the line numbers entirely).
// Mechanical application of those findings deletes hard-won specific
// anchors. This pass fetches the cited file and checks whether the symbol
// the note's link text names is actually defined within the original
// anchor's range. If yes, the finding is dropped as a false positive.
//
// Scope (intentionally narrow): only handles `source-verification` findings
// whose cited note line contains at least one anchored GitHub blob link
// `[<text>](https://github.com/<o>/<r>/blob/<ref>/<path>#L<a>[-L<b>])`.
// Findings on textual claims without a line anchor pass through unchanged
// (those are LLM-judgment calls; humans triage).
//
// Conservative: when in doubt (cannot fetch, cannot extract a symbol),
// keeps the finding. Pass 2 + human still get the last word.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fetchSources } from "./source-verify.js";
import type { FlatFinding } from "./types.js";

interface AnchoredLink {
  url: string;
  symbol: string; // identifier extracted from link text
  startLine: number;
  endLine: number;
}

const GH_BLOB_ANCHOR_RE: RegExp =
  /\[([^\]]+)\]\((https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\/[^/]+\/[^)#?]+)#L(\d+)(?:-L(\d+))?\)/g;

// Strip backticks, parens, and trailing punctuation to land on a bare
// JS/TS identifier. `formatPid()` -> `formatPid`, `Foo.bar` -> stays.
function extractSymbol(linkText: string): string | null {
  const cleaned: string = linkText
    .replace(/`/g, "")
    .replace(/\(\)/g, "")
    .trim();
  // Take the last identifier-shaped token (handles `SwcCompiler#loadSwcCliBinary`).
  const m: RegExpMatchArray | null = cleaned.match(/[A-Za-z_$][\w$]*$/);
  return m === null ? null : m[0];
}

function extractAnchoredLinks(line: string): AnchoredLink[] {
  const out: AnchoredLink[] = [];
  GH_BLOB_ANCHOR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GH_BLOB_ANCHOR_RE.exec(line)) !== null) {
    const symbol: string | null = extractSymbol(m[1]!);
    if (symbol === null) continue;
    const startLine: number = parseInt(m[3]!, 10);
    const endLine: number = m[4] !== undefined ? parseInt(m[4], 10) : startLine;
    out.push({ url: m[2]!, symbol, startLine, endLine });
  }
  return out;
}

// A symbol is "defined" at a line when that line contains an identifier-shaped
// declaration. We accept the following shapes (covers TS/JS):
//   `<symbol>(`              method/function call site that's also a definition
//   `function <symbol>`
//   `class <symbol>`
//   `(public|private|protected|readonly|async|static|export|const|let|var) <symbol>`
//   `<symbol>:`              property/object literal
// Conservative: a bare reference (`this.<symbol>(`) does NOT count, but a
// definition like `protected <symbol>(` does.
function symbolDefinedInRange(
  fileText: string,
  symbol: string,
  startLine: number,
  endLine: number,
): boolean {
  const lines: string[] = fileText.split("\n");
  const lo: number = Math.max(1, startLine) - 1;
  const hi: number = Math.min(lines.length, endLine) - 1;
  // Build a regex that matches a definition-shaped occurrence of `symbol`.
  const sym: string = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const defRe: RegExp = new RegExp(
    `(?:^|\\s)(?:function|class|interface|type|enum|const|let|var|public|private|protected|readonly|async|static|export|default)\\s+${sym}\\b` +
      `|\\b${sym}\\s*[(:=]` +
      `|^\\s*${sym}\\s*[(:]`,
  );
  for (let i: number = lo; i <= hi; i++) {
    if (defRe.test(lines[i]!)) return true;
  }
  return false;
}

interface VerifyResult {
  kept: FlatFinding[];
  dropped: { finding: FlatFinding; reason: string }[];
}

export async function runAnchorVerifyPass(
  findings: readonly FlatFinding[],
  opts: {
    repoRoot: string;
    log: (msg: string) => void;
  },
): Promise<VerifyResult> {
  const kept: FlatFinding[] = [];
  const dropped: { finding: FlatFinding; reason: string }[] = [];

  // Group by note path so we read each note once.
  const byPath: Map<string, FlatFinding[]> = new Map();
  for (const f of findings) {
    if (f.rule !== "source-verification") {
      kept.push(f);
      continue;
    }
    const arr: FlatFinding[] = byPath.get(f.path) ?? [];
    arr.push(f);
    byPath.set(f.path, arr);
  }

  for (const [notePath, perFile] of byPath) {
    let noteLines: string[];
    try {
      noteLines = readFileSync(
        resolve(opts.repoRoot, notePath),
        "utf8",
      ).split("\n");
    } catch {
      kept.push(...perFile);
      continue;
    }

    for (const finding of perFile) {
      const cited: string | undefined = noteLines[finding.line - 1];
      if (cited === undefined) {
        kept.push(finding);
        continue;
      }
      const links: AnchoredLink[] = extractAnchoredLinks(cited);
      if (links.length === 0) {
        kept.push(finding);
        continue;
      }
      // Only attempt verification when the finding message looks like an
      // anchor-disagreement claim ("real range", "real lines", "L<n>", etc).
      // Other source-verification findings (true contradictions on prose)
      // pass through unchanged.
      const message: string = finding.message;
      const looksLikeAnchorClaim: boolean =
        /\bL\d{2,}\b/.test(message) ||
        /\breal (?:range|lines?)\b/i.test(message) ||
        /\bcorresponds? to those lines\b/i.test(message);
      if (!looksLikeAnchorClaim) {
        kept.push(finding);
        continue;
      }

      // Verify each anchored link in the cited note line. If ANY of them
      // checks out (symbol defined within the cited range), the finding
      // is treated as a false positive.
      let verified: boolean = false;
      let verifiedReason: string = "";
      for (const link of links) {
        const fetched = (await fetchSources([link.url], opts.repoRoot))[0]!;
        if (fetched.text.length === 0) continue;
        if (
          symbolDefinedInRange(
            fetched.text,
            link.symbol,
            link.startLine,
            link.endLine,
          )
        ) {
          verified = true;
          verifiedReason = `\`${link.symbol}\` defined within ${link.url}#L${link.startLine}-L${link.endLine}`;
          break;
        }
      }

      if (verified) {
        dropped.push({
          finding,
          reason: `anchor verified: ${verifiedReason}`,
        });
        opts.log(
          `[anchor-verify] DROP ${finding.path}:${finding.line} (${verifiedReason})`,
        );
      } else {
        kept.push(finding);
      }
    }
  }

  return { kept, dropped };
}
