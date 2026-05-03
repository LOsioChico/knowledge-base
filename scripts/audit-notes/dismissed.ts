// Dismissed-finding registry.
//
// Stores triaged audit findings that have been verified as false positives or
// rule misapplications, so subsequent audit runs skip them automatically and
// the human triage queue stays small. Storage is `dismissed.json` (single
// repo-level file) keyed by a content-hash signature so dismissals survive
// line-number drift but re-fire when the underlying prose is rewritten (which
// is the right time to re-evaluate).
//
// Signature recipe: sha1(`${path}\0${rule}\0${trimmed line text at path:line}`).
// Path is included so identical lines in different files don't collide.
// Rule is included so a different audit rule firing on the same line still
// surfaces. Trimmed line text (not surrounding context) is the smallest stable
// unit: prose rewrites change the hash, leading-whitespace changes don't.

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import type { ConfidenceTier, FlatFinding, RuleId } from "./types.js";

export interface DismissedEntry {
  path: string;
  sig: string;
  rule: RuleId | "*";
  reason: string;
  date: string;
  // The trimmed line text at dismissal time. Stored for human-readability when
  // grepping `dismissed.json`; not used by signature matching (sig is the key).
  originalLine: string;
}

interface DismissedFile {
  entries: DismissedEntry[];
}

const REGISTRY_PATH: string = resolve(
  new URL(".", import.meta.url).pathname,
  "dismissed.json",
);

export function signFinding(
  repoRoot: string,
  path: string,
  rule: RuleId,
  line: number,
): string | null {
  const abs: string = resolve(repoRoot, path);
  if (!existsSync(abs)) return null;
  const lines: string[] = readFileSync(abs, "utf8").split("\n");
  // Audit findings use 1-indexed line numbers; some pipeline rules emit line=0
  // for whole-file findings — skip those (no stable text to hash).
  if (line < 1 || line > lines.length) return null;
  const text: string = (lines[line - 1] ?? "").trim();
  if (text.length === 0) return null;
  return createHash("sha1")
    .update(`${path}\0${rule}\0${text}`)
    .digest("hex");
}

export function loadDismissed(): DismissedEntry[] {
  if (!existsSync(REGISTRY_PATH)) return [];
  const raw: string = readFileSync(REGISTRY_PATH, "utf8");
  const parsed: DismissedFile = JSON.parse(raw) as DismissedFile;
  return parsed.entries ?? [];
}

export interface FilterResult<T extends FlatFinding> {
  kept: T[];
  dropped: Array<{ finding: T; entry: DismissedEntry }>;
}

export function filterDismissed<
  T extends FlatFinding & { tier: ConfidenceTier },
>(repoRoot: string, findings: T[]): FilterResult<T> {
  const entries: DismissedEntry[] = loadDismissed();
  if (entries.length === 0) return { kept: findings, dropped: [] };
  const bySig: Map<string, DismissedEntry> = new Map<string, DismissedEntry>();
  for (const e of entries) bySig.set(e.sig, e);
  const kept: T[] = [];
  const dropped: FilterResult<T>["dropped"] = [];
  for (const f of findings) {
    const sig: string | null = signFinding(repoRoot, f.path, f.rule, f.line);
    const entry: DismissedEntry | undefined =
      sig !== null ? bySig.get(sig) : undefined;
    if (entry !== undefined) {
      dropped.push({ finding: f, entry });
    } else {
      kept.push(f);
    }
  }
  return { kept, dropped };
}
