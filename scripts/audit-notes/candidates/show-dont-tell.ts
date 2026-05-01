// Deterministic candidate finder for the `show-dont-tell` rule.
//
// Strategy (technique B from the precision-tightening plan):
//   1. Walk the markdown line-by-line, ignoring code fences and frontmatter.
//   2. Flag any prose line that contains a behavioral-claim trigger phrase
//      (returns 4xx, throws, strips, silently, rejects, is undefined, etc.).
//   3. For each flagged line, look ahead up to 30 lines for evidence that the
//      claim is "shown" — i.e. a fenced block that contains both a request-
//      shaped sample and a response-shaped sample. If shown, drop. Otherwise
//      emit a candidate for the LLM judge to confirm.
//
// The LLM then answers a single binary question per candidate ("is the claim
// backed by a demonstrable request/response pair within the next 30 lines: y/n").
// This decomposition replaces the open-ended "audit the whole file for show-
// dont-tell" pass and removes the dominant FP source (model inventing claims).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ShowDontTellCandidate {
  path: string; // repo-relative
  line: number; // 1-based, the prose line with the claim
  claim: string; // the prose line itself (≤ 200 chars)
  context: string; // claim + ~30 lines below, with line numbers prefixed
}

// Trigger phrases that almost always mark a behavioral claim worth showing.
// Tuned conservatively: missing a real claim is preferable to flagging filler.
const TRIGGER_RE: RegExp = new RegExp(
  [
    String.raw`\breturns? \d{3}\b`,
    String.raw`\bthrows? (a |an |the )?[A-Z]\w*Error\b`,
    String.raw`\bthrows? (a |an |the )?[A-Z]\w*Exception\b`,
    String.raw`\bstrips?( out)? [a-z_]+\b`,
    String.raw`\bsilently (passes|fails|drops|ignores|coerces)\b`,
    String.raw`\brejects? (the |a |an )?(payload|request|body|input)\b`,
    String.raw`\bis undefined\b`,
    String.raw`\bcoerces? (to|into) `,
    String.raw`\bdefaults? to `,
    String.raw`\bresponds? with (a )?\d{3}\b`,
    String.raw`\bshape (is|becomes) `,
    String.raw`\bemit(s|ted) (a )?\d{3}\b`,
  ].join("|"),
  "i",
);

// Request-evidence: curl, http verbs, fetch/axios, supertest-style.
const REQUEST_RE: RegExp =
  /\bcurl\b|\bPOST \/|\bGET \/|\bPUT \/|\bPATCH \/|\bDELETE \/|await fetch\(|axios\.\w+\(|request\(app\)|app\.inject\(|supertest\(/i;

// Response-evidence: status code line, JSON literal beginning with {, "statusCode":.
const RESPONSE_RE: RegExp =
  /HTTP\/[12](\.\d)? \d{3}|^\s*\{[\s\S]*"(message|statusCode|error)"|^\s*\d{3}\s+\w+/m;

// Skip lines that look like:
//   - `[!example]` callout headers (worked examples, not claims)
//   - opening/closing fences (defensive; inCodeAt should already cover)
//   - markdown table rows (config tables, symptom tables — narrative reference,
//     not behavioral claims that need req+res evidence)
const NOISE_LINE_RE: RegExp = /^\s*(>\s*)?\[!example\]|^\s*```|^\s*\|/;

// Trigger-exclusion: prose that hits TRIGGER_RE but is talking about CLI
// scaffolding, generator output, or other meta concerns rather than runtime
// behavior. Skip when any of these appears on the same line.
const META_EXCLUSION_RE: RegExp =
  /\b(CLI|generator|generators|scaffold|scaffolds|wrapping|wrapper|folder|directory|workspace)\b/i;

// Lines inside this many leading body lines are skipped: that's the recipe
// tagline zone (single `>` blockquote summarizing the recipe per AGENTS.md
// template). Taglines describe scope, not behavior; they shouldn't trigger.
const TAGLINE_GUARD_LINES: number = 25;

interface Block {
  startLine: number; // 1-based, line of opening ```
  endLine: number; // 1-based, line of closing ```
  body: string;
}

interface ScannedFile {
  lines: readonly string[];
  codeBlocks: readonly Block[];
  inCodeAt: ReadonlySet<number>; // 1-based line numbers inside any fence
}

function scanFile(repoRelPath: string, repoRoot: string): ScannedFile {
  const abs: string = resolve(repoRoot, repoRelPath);
  const text: string = readFileSync(abs, "utf8");
  const lines: string[] = text.split("\n");
  const inCode: Set<number> = new Set();
  const blocks: Block[] = [];
  let openLine: number = -1;
  let openBuf: string[] = [];
  // Frontmatter: skip everything up to the second `---`.
  let frontEnd: number = 0;
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === "---") {
        frontEnd = i + 1; // 0-based exclusive
        break;
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (i < frontEnd) continue;
    const raw: string = lines[i] ?? "";
    // Treat blockquoted fences (`> \`\`\``) the same as fences.
    const stripped: string = raw.replace(/^\s*>\s?/, "");
    const isFence: boolean = /^\s*```/.test(stripped);
    if (isFence) {
      if (openLine === -1) {
        openLine = i + 1;
        openBuf = [];
      } else {
        blocks.push({
          startLine: openLine,
          endLine: i + 1,
          body: openBuf.join("\n"),
        });
        for (let k = openLine; k <= i + 1; k++) inCode.add(k);
        openLine = -1;
      }
      continue;
    }
    if (openLine !== -1) openBuf.push(stripped);
  }
  return { lines, codeBlocks: blocks, inCodeAt: inCode };
}

function nearbyCodeBlocks(
  scanned: ScannedFile,
  fromLine: number,
  windowLines: number,
): Block[] {
  return scanned.codeBlocks.filter(
    (b: Block): boolean =>
      b.startLine >= fromLine && b.startLine <= fromLine + windowLines,
  );
}

function blockHasEvidence(b: Block): { req: boolean; res: boolean } {
  return {
    req: REQUEST_RE.test(b.body),
    res: RESPONSE_RE.test(b.body),
  };
}

function buildContext(
  lines: readonly string[],
  startLine: number,
  windowLines: number,
): string {
  const out: string[] = [];
  const max: number = Math.min(lines.length, startLine + windowLines);
  for (let i: number = startLine; i <= max; i++) {
    out.push(`L${i}: ${lines[i - 1] ?? ""}`);
  }
  return out.join("\n");
}

export function findShowDontTellCandidates(
  repoRoot: string,
  repoRelPath: string,
): ShowDontTellCandidate[] {
  const scanned: ScannedFile = scanFile(repoRelPath, repoRoot);
  const candidates: ShowDontTellCandidate[] = [];
  const WINDOW: number = 30;

  // Locate first non-frontmatter, non-blank body line so the tagline guard is
  // anchored to actual content rather than the frontmatter offset.
  let bodyStart: number = 1;
  for (let i: number = 0; i < scanned.lines.length; i++) {
    const ln: string = scanned.lines[i] ?? "";
    if (ln.trim() && ln.trim() !== "---") {
      bodyStart = i + 1;
      break;
    }
  }

  for (let i: number = 0; i < scanned.lines.length; i++) {
    const lineNo: number = i + 1;
    if (scanned.inCodeAt.has(lineNo)) continue;
    if (lineNo < bodyStart + TAGLINE_GUARD_LINES) continue;
    const line: string = scanned.lines[i] ?? "";
    if (!line.trim()) continue;
    if (NOISE_LINE_RE.test(line)) continue;
    if (!TRIGGER_RE.test(line)) continue;
    if (META_EXCLUSION_RE.test(line)) continue;

    // Look ahead: if a nearby block already shows req+res, mark satisfied.
    const blocks: Block[] = nearbyCodeBlocks(scanned, lineNo, WINDOW);
    let satisfied: boolean = false;
    let cumulativeReq: boolean = false;
    let cumulativeRes: boolean = false;
    for (const b of blocks) {
      const ev = blockHasEvidence(b);
      cumulativeReq = cumulativeReq || ev.req;
      cumulativeRes = cumulativeRes || ev.res;
      if (cumulativeReq && cumulativeRes) {
        satisfied = true;
        break;
      }
    }
    if (satisfied) continue;

    candidates.push({
      path: repoRelPath,
      line: lineNo,
      claim: line.slice(0, 200),
      context: buildContext(scanned.lines, lineNo, WINDOW),
    });
  }
  return candidates;
}
