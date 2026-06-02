#!/usr/bin/env -S npx tsx
// Contradiction scanner: find factual contradictions between related notes.
//
// Deterministic candidate selection (related: frontmatter + body wikilinks),
// then LLM-powered claim extraction and cross-check.
//
// Usage:
//   CURSOR_API_KEY=... tsx contradiction-scan.ts
//   CURSOR_API_KEY=... tsx contradiction-scan.ts --area nestjs
//   CURSOR_API_KEY=... tsx contradiction-scan.ts --cross-area
//   CURSOR_API_KEY=... tsx contradiction-scan.ts --json

import { Agent } from "@cursor/sdk";
import type { Run, RunResult, SDKMessage } from "@cursor/sdk";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

import { readFromCache, writeToCache, computeHash } from "./cache-helper.js";
import { extractJson } from "./extract-json.js";
import { filterDismissed } from "./dismissed.js";
import type { FlatFinding } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT: string = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const MDX_ROOT: string = join(REPO_ROOT, "sites/docs/src/content/docs");
const SKILL_PATH: string = resolve(
  REPO_ROOT,
  ".github/skills/kb-contradiction-judge/SKILL.md",
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoteInfo {
  /** Relative path from repo root */
  path: string;
  /** Absolute path */
  absPath: string;
  /** Slug (relative to content docs, no extension) */
  slug: string;
  /** Top-level area (first path segment) */
  area: string;
  /** Frontmatter data */
  data: Record<string, unknown>;
  /** Raw file content */
  content: string;
  /** related: wikilink targets (normalized slugs) */
  relatedSlugs: string[];
  /** Body wikilink targets (normalized slugs) */
  bodyWikilinkSlugs: string[];
}

interface ContradictionClaim {
  file: string;
  line: number;
  text: string;
}

interface Contradiction {
  claimA: ContradictionClaim;
  claimB: ContradictionClaim;
  description: string;
  confidence: "high" | "medium";
}

interface LLMResult {
  contradictions: Contradiction[];
}

interface CandidatePair {
  a: NoteInfo;
  b: NoteInfo;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Args {
  areaFilter: string | null;
  crossArea: boolean;
  jsonOnly: boolean;
}

function parseArgs(): Args {
  const argv: string[] = process.argv.slice(2);
  let areaFilter: string | null = null;
  const areaIdx: number = argv.indexOf("--area");
  if (areaIdx !== -1) {
    areaFilter = argv[areaIdx + 1] ?? null;
    if (areaFilter === null) {
      console.error("error: --area requires a value");
      process.exit(2);
    }
  }
  return {
    areaFilter,
    crossArea: argv.includes("--cross-area"),
    jsonOnly: argv.includes("--json"),
  };
}

// ---------------------------------------------------------------------------
// Note loading
// ---------------------------------------------------------------------------

function walkMdx(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full: string = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkMdx(full, out);
    else if (st.isFile() && entry.endsWith(".mdx")) out.push(full);
  }
}

function normalizeWikilinkTarget(raw: string): string {
  return raw
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]!
    .split("#")[0]!
    .trim()
    .replace(/\.mdx?$/, "")
    .replace(/\/$/, "");
}

function extractBodyWikilinks(content: string): string[] {
  const bodyStart = content.indexOf("\n---\n", 4);
  if (bodyStart === -1) return [];
  const body: string = content.slice(bodyStart + 5);
  const matches: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    matches.push(normalizeWikilinkTarget(m[0]!));
  }
  return [...new Set(matches)];
}

function loadNotes(areaFilter: string | null): NoteInfo[] {
  const files: string[] = [];
  walkMdx(MDX_ROOT, files);
  files.sort();

  const notes: NoteInfo[] = [];
  for (const absPath of files) {
    const relPath: string = relative(REPO_ROOT, absPath);
    const slug: string = relative(MDX_ROOT, absPath)
      .replace(/\.mdx$/, "")
      .replace(/\/index$/, "");
    const area: string = slug.split("/")[0] ?? "";

    // Skip index files (MOCs) — they summarize, don't make factual claims
    if (absPath.endsWith("/index.mdx")) continue;
    // Area filter
    if (areaFilter !== null && area !== areaFilter) continue;

    const content: string = readFileSync(absPath, "utf8");
    let data: Record<string, unknown> = {};
    try {
      data = (matter(content).data as Record<string, unknown>) ?? {};
    } catch {
      // skip unparseable frontmatter
    }

    const relatedRaw: string[] = Array.isArray(data["related"])
      ? (data["related"] as string[])
      : [];
    const relatedSlugs: string[] = relatedRaw.map(normalizeWikilinkTarget);
    const bodyWikilinkSlugs: string[] = extractBodyWikilinks(content);

    notes.push({
      path: relPath,
      absPath,
      slug,
      area,
      data,
      content,
      relatedSlugs,
      bodyWikilinkSlugs,
    });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Candidate pair selection
// ---------------------------------------------------------------------------

function buildCandidatePairs(
  notes: NoteInfo[],
  crossArea: boolean,
): CandidatePair[] {
  const bySlug: Map<string, NoteInfo> = new Map();
  for (const note of notes) bySlug.set(note.slug, note);

  const seen: Set<string> = new Set();
  const pairs: CandidatePair[] = [];

  for (const note of notes) {
    const allConnected: Set<string> = new Set([
      ...note.relatedSlugs,
      ...note.bodyWikilinkSlugs,
    ]);

    for (const targetSlug of allConnected) {
      const target: NoteInfo | undefined = bySlug.get(targetSlug);
      if (target === undefined) continue;

      // Same-area filter (unless --cross-area)
      if (!crossArea && note.area !== target.area) continue;

      // Deduplicate: canonical key is sorted pair
      const key: string = [note.slug, target.slug].sort().join("\0");
      if (seen.has(key)) continue;
      seen.add(key);

      pairs.push({ a: note, b: target });
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// LLM integration
// ---------------------------------------------------------------------------

let JSON_ONLY = false;

function log(msg: string): void {
  if (!JSON_ONLY) console.error(msg);
}

async function runAgent(prompt: string, label: string): Promise<string> {
  const apiKey = process.env["CURSOR_API_KEY"] ?? "";
  await using agent = await Agent.create({
    apiKey,
    model: { id: "composer-2.5", params: [{ id: "fast", value: "true" }] },
    local: { cwd: REPO_ROOT, settingSources: ["project"] },
  });
  const run: Run = await agent.send(prompt);
  let buf = "";
  for await (const event of run.stream() as AsyncIterable<SDKMessage>) {
    if (event.type === "assistant") {
      for (const block of event.message.content) {
        if (block.type === "text") {
          buf += block.text;
        }
      }
    }
  }
  const result: RunResult = await run.wait();
  if (result.status !== "finished") {
    throw new Error(`${label} failed: status=${result.status}`);
  }
  return buf;
}

function buildPrompt(
  pair: CandidatePair,
  skillContent: string,
): string {
  return [
    "Use the `kb-contradiction-judge` skill to find contradictions between these two related notes.",
    "We have provided the skill instructions and both note contents below so you do NOT need to run any tools.",
    "",
    "=== SYSTEM SKILL: `kb-contradiction-judge` ===",
    skillContent,
    "",
    `=== NOTE A: ${pair.a.path} ===`,
    "```mdx",
    pair.a.content,
    "```",
    "",
    `=== NOTE B: ${pair.b.path} ===`,
    "```mdx",
    pair.b.content,
    "```",
    "",
    "Output a single JSON object matching the skill output schema. JSON only.",
  ].join("\n");
}

// Cache key for a pair: incorporates both files' content + skill content
function pairCacheKey(pair: CandidatePair): string {
  // Sort to ensure A,B and B,A produce same key
  const [first, second] = [pair.a.path, pair.b.path].sort() as [string, string];
  return `${first}\0${second}`;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

async function scanPair(
  pair: CandidatePair,
  skillContent: string,
): Promise<FlatFinding[]> {
  const cacheFilePath: string = pairCacheKey(pair);
  // Combined content for cache invalidation
  const combinedContent: string = pair.a.content + "\0" + pair.b.content;

  const cached = readFromCache<FlatFinding[]>(
    REPO_ROOT,
    "contradiction",
    cacheFilePath,
    combinedContent,
    skillContent,
  );
  if (cached !== null) {
    log(`[contradiction] cache hit: ${pair.a.slug} <-> ${pair.b.slug}`);
    return cached;
  }

  log(
    `[contradiction] scanning: ${pair.a.slug} <-> ${pair.b.slug} (running LLM...)`,
  );
  const prompt: string = buildPrompt(pair, skillContent);
  const text: string = await runAgent(
    prompt,
    `contradiction:${pair.a.slug}+${pair.b.slug}`,
  );

  let result: LLMResult;
  try {
    result = JSON.parse(extractJson(text)) as LLMResult;
  } catch (err) {
    log(
      `[contradiction] JSON parse error for ${pair.a.slug} <-> ${pair.b.slug}: ${err}`,
    );
    return [];
  }

  const findings: FlatFinding[] = result.contradictions.map(
    (c: Contradiction): FlatFinding => ({
      rule: "contradiction" as FlatFinding["rule"],
      path: c.claimA.file,
      line: c.claimA.line,
      message: `${c.description} [${c.confidence}]\n    Note A (${c.claimA.file}:${c.claimA.line}): "${c.claimA.text}"\n    Note B (${c.claimB.file}:${c.claimB.line}): "${c.claimB.text}"`,
      evidence: c.claimA.text.slice(0, 120),
    }),
  );

  writeToCache(
    REPO_ROOT,
    "contradiction",
    cacheFilePath,
    combinedContent,
    skillContent,
    findings,
  );

  return findings;
}

export async function scanContradictions(
  repoRoot: string,
  areaFilter: string | null = null,
  crossArea: boolean = false,
): Promise<FlatFinding[]> {
  const notes: NoteInfo[] = loadNotes(areaFilter);
  const pairs: CandidatePair[] = buildCandidatePairs(notes, crossArea);
  log(
    `[contradiction] ${notes.length} notes, ${pairs.length} candidate pairs`,
  );

  if (pairs.length === 0) return [];

  const skillContent: string = readFileSync(SKILL_PATH, "utf8");
  const allFindings: FlatFinding[] = [];

  // Process pairs sequentially to avoid rate limits
  for (const pair of pairs) {
    const findings: FlatFinding[] = await scanPair(pair, skillContent);
    allFindings.push(...findings);
  }

  // Apply dismissed.json filtering
  const { kept } = filterDismissed(repoRoot, allFindings);
  return kept;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args: Args = parseArgs();
  JSON_ONLY = args.jsonOnly;

  if ((process.env["CURSOR_API_KEY"] ?? "") === "") {
    console.error("error: CURSOR_API_KEY required");
    process.exit(2);
  }

  const findings: FlatFinding[] = await scanContradictions(
    REPO_ROOT,
    args.areaFilter,
    args.crossArea,
  );

  if (JSON_ONLY) {
    process.stdout.write(JSON.stringify({ findings }, null, 2) + "\n");
  } else {
    if (findings.length === 0) {
      console.log("✓ contradiction-scan: no contradictions found");
    } else {
      console.error(
        `✗ contradiction-scan: ${findings.length} contradiction(s) found\n`,
      );
      for (const f of findings) {
        console.error(`  ${f.path}:${f.line}`);
        console.error(`    ${f.message}\n`);
      }
    }
  }

  process.exitCode = findings.length > 0 ? 1 : 0;
}

main().catch((err: unknown) => {
  console.error("contradiction-scan failed:", err);
  process.exit(2);
});
