// Pass 1d: deterministic substring fact-grounding for source-verification.
//
// Mirrors Pass 1c (anchor-verifier) for the non-anchor false-positive class.
// For each `source-verification` finding emitted as "Not supported by cited
// sources" (the unsupported / unsourced classes — NOT contradictions), extract
// high-information terms from the claim and grep them across the cached
// source extracts. If ALL terms appear in at least one source, the LLM
// missed it: drop the finding as a false positive.
//
// Conservative by design:
//   - Only fires on `source-verification` findings whose message starts with
//     "Not supported by" (i.e. unsupported / unsourced-but-plausible). Never
//     touches "Contradicts" findings — those need human eyes.
//   - Keeps the finding when term extraction yields fewer than 2 terms (not
//     enough signal to vote).
//   - Keeps the finding when no source files are cached (can't verify).
//   - Re-uses the on-disk cache populated by `source-verify.ts` in the same
//     process; no network calls.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import type { FlatFinding } from "./types.js";
import { extractSourceUrls } from "./source-verify.js";

// Mirrors `source-verify.ts:cacheKey`. Kept private here to avoid widening
// that module's public surface for one helper.
function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

function cachedSourcePath(repoRoot: string, url: string): string {
  return resolve(
    repoRoot,
    "scripts/audit-notes/.cache/sources",
    `${cacheKey(url)}.txt`,
  );
}

const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "been", "but", "by",
  "can", "could", "did", "do", "does", "doing", "for", "from", "had", "has",
  "have", "if", "in", "into", "is", "it", "its", "may", "must", "no", "not",
  "of", "on", "or", "should", "so", "than", "that", "the", "their", "them",
  "then", "there", "these", "they", "this", "those", "to", "too", "via",
  "was", "were", "what", "when", "where", "which", "while", "who", "why",
  "will", "with", "would",
  // audit-domain noise
  "claim", "claims", "cited", "cites", "source", "sources", "note", "notes",
  "supported", "unsupported", "contradicts", "contradicted", "explanation",
  "above", "below", "section", "field", "fields", "value", "values",
]);

// Pull terms that carry verification signal:
//   - backtick-fenced spans: `getAllAndMerge`, `app.useGlobalPipes`
//   - identifiers (CamelCase, snake_case, dotted): `ParseDatePipeOptions`
//   - version numbers: `v10.4`, `0.14`, `11`
//   - long-ish words (>= 5 chars, not stopwords)
function extractTerms(claim: string): string[] {
  const terms: Set<string> = new Set();

  // Backtick spans (highest signal — the author's own emphasized identifiers).
  for (const m of claim.matchAll(/`([^`]+)`/g)) {
    const span: string = (m[1] ?? "").trim();
    if (span.length >= 2) terms.add(span.toLowerCase());
  }

  // Identifier-shaped tokens: must contain a capital, a digit, an underscore,
  // a dot, or be all-lowercase >= 5 chars.
  const tokenRe: RegExp = /[A-Za-z][\w$.]{2,}/g;
  for (const m of claim.matchAll(tokenRe)) {
    const tok: string = m[0] ?? "";
    const lower: string = tok.toLowerCase();
    if (STOPWORDS.has(lower)) continue;
    const hasShape: boolean =
      /[A-Z]/.test(tok) ||
      /[._$]/.test(tok) ||
      /\d/.test(tok) ||
      tok.length >= 5;
    if (hasShape) terms.add(lower);
  }

  // Version numbers: v10.4, 0.14, 11+
  for (const m of claim.matchAll(/\bv?\d+(?:\.\d+)+\b/g)) {
    terms.add((m[0] ?? "").toLowerCase());
  }

  return Array.from(terms);
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").toLowerCase();
}

export interface FactGroundDeps {
  repoRoot: string;
  /** Map of `notePath -> source URLs`. If absent, read from disk. */
  sourceUrlsByPath?: ReadonlyMap<string, readonly string[]>;
  log: (msg: string) => void;
}

export interface FactGroundResult {
  kept: FlatFinding[];
  dropped: Array<{ finding: FlatFinding; reason: string; matchedTerms: string[] }>;
}

const MIN_TERMS: number = 2;
const MAX_CACHE_BYTES: number = 200_000;

export function runFactGroundPass(
  findings: readonly FlatFinding[],
  deps: FactGroundDeps,
): FactGroundResult {
  const { repoRoot, log } = deps;
  const kept: FlatFinding[] = [];
  const dropped: Array<{
    finding: FlatFinding;
    reason: string;
    matchedTerms: string[];
  }> = [];

  // Cache: per-note normalized source bodies.
  const sourceCache: Map<string, string[]> = new Map();

  function loadSources(notePath: string): string[] {
    const cached: string[] | undefined = sourceCache.get(notePath);
    if (cached !== undefined) return cached;
    let urls: readonly string[] | undefined = deps.sourceUrlsByPath?.get(
      notePath,
    );
    if (urls === undefined) {
      const abs: string = resolve(repoRoot, notePath);
      if (!existsSync(abs)) {
        sourceCache.set(notePath, []);
        return [];
      }
      urls = extractSourceUrls(readFileSync(abs, "utf8"));
    }
    const bodies: string[] = [];
    for (const u of urls) {
      const p: string = cachedSourcePath(repoRoot, u);
      if (!existsSync(p)) continue;
      try {
        let body: string = readFileSync(p, "utf8");
        if (body.length > MAX_CACHE_BYTES) body = body.slice(0, MAX_CACHE_BYTES);
        bodies.push(normalize(body));
      } catch {
        // skip unreadable
      }
    }
    sourceCache.set(notePath, bodies);
    return bodies;
  }

  for (const f of findings) {
    if (f.rule !== "source-verification") {
      kept.push(f);
      continue;
    }
    // Only act on "Not supported" findings — never on "Contradicts".
    if (!f.message.startsWith("Not supported by")) {
      kept.push(f);
      continue;
    }
    // Extract the claim portion: "Not supported by cited sources: <claim>. <explanation>"
    const claimMatch: RegExpExecArray | null =
      /^Not supported by cited sources:\s*(.+?)\.\s/.exec(f.message);
    const claim: string =
      claimMatch !== null ? (claimMatch[1] ?? "") : f.message;
    const terms: string[] = extractTerms(claim);
    if (terms.length < MIN_TERMS) {
      kept.push(f);
      continue;
    }
    const sources: string[] = loadSources(f.path);
    if (sources.length === 0) {
      kept.push(f);
      continue;
    }
    // A term "matches" if it appears as a substring in at least one source body.
    const matched: string[] = terms.filter((t: string): boolean =>
      sources.some((s: string): boolean => s.includes(t)),
    );
    if (matched.length === terms.length) {
      dropped.push({
        finding: f,
        reason: `all ${terms.length} extracted terms (${terms.join(", ")}) found in cached source extracts`,
        matchedTerms: matched,
      });
      log(
        `[fact-ground] DROP ${f.path}:${f.line} (terms in source: ${terms.join(", ")})`,
      );
    } else {
      kept.push(f);
    }
  }
  return { kept, dropped };
}
