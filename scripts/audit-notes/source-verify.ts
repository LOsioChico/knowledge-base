// Source verification pass.
//
// For each target note:
//   1. Extract `source:` URLs from YAML frontmatter.
//   2. Fetch each URL (cached on disk under `.cache/sources/`, ~30-day TTL).
//   3. Strip HTML to plain text.
//   4. Send (note body + concatenated source extracts) to the LLM with the
//      `kb-source-verifier` skill.
//   5. Parse JSON response into `source-verification` findings.
//
// Opt-in via `--verify-sources`. Network + ~10-30k extra tokens per note.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import type { FlatFinding } from "./types.js";

const TTL_MS: number = 30 * 24 * 60 * 60 * 1000;
const MAX_SOURCE_CHARS: number = 12_000;
const FETCH_TIMEOUT_MS: number = 15_000;

interface FetchedSource {
  url: string;
  text: string;
  fromCache: boolean;
  error?: string;
}

interface VerifierFinding {
  line: number;
  claim: string;
  status: "unsupported" | "contradicted";
  explanation: string;
  evidence?: string;
}

interface VerifierReport {
  findings: VerifierFinding[];
}

function cacheDir(repoRoot: string): string {
  return resolve(repoRoot, "scripts/audit-notes/.cache/sources");
}

function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

export function extractSourceUrls(noteText: string): string[] {
  if (!noteText.startsWith("---\n")) return [];
  const closeIdx: number = noteText.indexOf("\n---", 4);
  if (closeIdx === -1) return [];
  const frontmatter: string = noteText.slice(4, closeIdx);
  const lines: string[] = frontmatter.split("\n");
  const urls: string[] = [];
  let inSourceBlock: boolean = false;
  for (const raw of lines) {
    const line: string = raw.trimEnd();
    if (/^source:\s*$/.test(line)) {
      inSourceBlock = true;
      continue;
    }
    if (inSourceBlock) {
      const m: RegExpExecArray | null = /^\s*-\s*(.+)$/.exec(line);
      if (m === null) {
        // Block ended.
        if (/^\S/.test(line)) inSourceBlock = false;
        continue;
      }
      const candidate: string = m[1]!.trim().replace(/^["']|["']$/g, "");
      if (/^https?:\/\//.test(candidate)) urls.push(candidate);
      continue;
    }
    // Inline form: `source: https://...` or `source: [url1, url2]`
    const inlineSingle: RegExpExecArray | null =
      /^source:\s*(https?:\/\/\S+)\s*$/.exec(line);
    if (inlineSingle !== null) urls.push(inlineSingle[1]!);
    const inlineList: RegExpExecArray | null = /^source:\s*\[(.+)\]\s*$/.exec(
      line,
    );
    if (inlineList !== null) {
      for (const part of inlineList[1]!.split(",")) {
        const candidate: string = part.trim().replace(/^["']|["']$/g, "");
        if (/^https?:\/\//.test(candidate)) urls.push(candidate);
      }
    }
  }
  return urls;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|pre|code)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x?[0-9a-f]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchOne(
  url: string,
  repoRoot: string,
): Promise<FetchedSource> {
  const dir: string = cacheDir(repoRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path: string = resolve(dir, `${cacheKey(url)}.txt`);
  const meta: string = `${path}.meta.json`;

  // Cache hit?
  if (existsSync(path) && existsSync(meta)) {
    try {
      const m = JSON.parse(readFileSync(meta, "utf8")) as { fetchedAt: number };
      const age: number = Date.now() - m.fetchedAt;
      if (age < TTL_MS) {
        return { url, text: readFileSync(path, "utf8"), fromCache: true };
      }
    } catch {
      // fall through and refetch
    }
  }

  try {
    const ctrl: AbortController = new AbortController();
    const timer: NodeJS.Timeout = setTimeout(
      () => ctrl.abort(),
      FETCH_TIMEOUT_MS,
    );
    const resp: Response = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        // Pretend to be a real browser; some doc sites 403 obvious bots.
        "user-agent":
          "Mozilla/5.0 (compatible; kb-source-verifier/1.0; +https://github.com/losiochico/knowledge-base)",
        accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const ct: string = resp.headers.get("content-type") ?? "";
    const raw: string = await resp.text();
    const text: string = ct.includes("html") ? htmlToText(raw) : raw;
    // SPA shells (Next.js, etc.) return a near-empty document on plain fetch.
    // Flag those so the LLM doesn't try to verify against essentially nothing.
    if (text.length < 500 && ct.includes("html")) {
      writeFileSync(path, text, "utf8");
      writeFileSync(meta, JSON.stringify({ url, fetchedAt: Date.now() }), "utf8");
      return {
        url,
        text,
        fromCache: false,
        error: `fetched only ${text.length} chars of text (likely SPA shell; needs JS rendering)`,
      };
    }
    writeFileSync(path, text, "utf8");
    writeFileSync(meta, JSON.stringify({ url, fetchedAt: Date.now() }), "utf8");
    return { url, text, fromCache: false };
  } catch (err) {
    // Network failure: fall back to stale cache if it exists.
    if (existsSync(path)) {
      return {
        url,
        text: readFileSync(path, "utf8"),
        fromCache: true,
        error: `refetch failed (${err instanceof Error ? err.message : String(err)}); using stale cache`,
      };
    }
    return {
      url,
      text: "",
      fromCache: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchSources(
  urls: readonly string[],
  repoRoot: string,
): Promise<FetchedSource[]> {
  const out: FetchedSource[] = [];
  for (const u of urls) {
    out.push(await fetchOne(u, repoRoot));
  }
  return out;
}

function buildVerifierPrompt(
  notePath: string,
  noteBody: string,
  sources: readonly FetchedSource[],
): string {
  const sourceBlocks: string = sources
    .map((s, idx): string => {
      const header: string =
        s.error !== undefined
          ? `[${idx + 1}] ${s.url}\n!! FETCH ERROR: ${s.error}`
          : `[${idx + 1}] ${s.url}${s.fromCache ? " (cached)" : ""}`;
      const body: string = s.text.slice(0, MAX_SOURCE_CHARS);
      return `${header}\n---\n${body}\n---`;
    })
    .join("\n\n");

  return [
    "Use the `kb-source-verifier` skill.",
    "",
    `NOTE PATH: ${notePath}`,
    "NOTE BODY (with 1-based line numbers):",
    "---",
    noteBody
      .split("\n")
      .map((l: string, i: number): string => `L${i + 1}: ${l}`)
      .join("\n"),
    "---",
    "",
    "CITED SOURCES (extracted plain text from `source:` URLs in the note's frontmatter):",
    sourceBlocks.length > 0 ? sourceBlocks : "(none)",
    "",
    "Output a single JSON object matching the skill's `Report` schema. JSON only — no prose, no Markdown, no fenced block.",
  ].join("\n");
}

interface SourceVerifyArgs {
  repoRoot: string;
  targets: readonly string[];
  runAgent: (prompt: string, label: string) => Promise<string>;
  extractJson: (text: string) => string;
  log: (msg: string) => void;
}

export async function runSourceVerifyPass(
  args: SourceVerifyArgs,
): Promise<FlatFinding[]> {
  const { repoRoot, targets, runAgent, extractJson, log } = args;
  const findings: FlatFinding[] = [];

  for (const target of targets) {
    const abs: string = resolve(repoRoot, target);
    if (!existsSync(abs)) {
      log(`[source-verify] skip (missing): ${target}`);
      continue;
    }
    const noteText: string = readFileSync(abs, "utf8");
    const urls: string[] = extractSourceUrls(noteText);
    if (urls.length === 0) {
      log(`[source-verify] skip (no source: URLs): ${target}`);
      continue;
    }
    log(`[source-verify] ${target}: ${urls.length} source URL(s)`);

    const sources: FetchedSource[] = await fetchSources(urls, repoRoot);
    const fetched: number = sources.filter(
      (s): boolean => s.error === undefined,
    ).length;
    const cached: number = sources.filter((s): boolean => s.fromCache).length;
    log(
      `  fetched=${fetched - cached} cached=${cached} failed=${sources.length - fetched}`,
    );
    for (const s of sources) {
      if (s.error !== undefined) log(`  - ${s.url}: ${s.error}`);
    }

    const prompt: string = buildVerifierPrompt(target, noteText, sources);
    const text: string = await runAgent(prompt, `source-verify:${target}`);
    let parsed: VerifierReport;
    try {
      parsed = JSON.parse(extractJson(text)) as VerifierReport;
    } catch (err) {
      log(
        `[source-verify] failed to parse response for ${target}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
    for (const f of parsed.findings ?? []) {
      // Get raw stat info to filter out lines outside the note.
      const totalLines: number = noteText.split("\n").length;
      if (f.line < 1 || f.line > totalLines) continue;
      findings.push({
        rule: "source-verification",
        path: target,
        line: f.line,
        message: `${f.status === "contradicted" ? "Contradicts" : "Not supported by"} cited sources: ${f.claim}. ${f.explanation}`,
        ...(f.evidence !== undefined
          ? { evidence: f.evidence.slice(0, 120) }
          : {}),
      });
    }
    log(
      `[source-verify] ${target}: ${parsed.findings?.length ?? 0} finding(s)`,
    );
  }

  return findings;
}
