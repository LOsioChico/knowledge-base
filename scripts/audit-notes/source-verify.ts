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
// Always on. CURSOR_API_KEY must be set or the script exits non-zero.
// Network + ~10-30k extra tokens per note.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { FlatFinding } from "./types.js";
import { readVotingConfig, runWithVoting } from "./voting.js";

const TTL_MS: number = 30 * 24 * 60 * 60 * 1000;
const MAX_SOURCE_CHARS: number = 40_000;
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
  status: "unsupported" | "unsourced-but-plausible" | "contradicted";
  explanation: string;
  evidence?: string;
  suggestedSourceUrl?: string;
}

interface VerifierReport {
  findings: VerifierFinding[];
}

function cacheDir(repoRoot: string): string {
  return resolve(repoRoot, "scripts/audit-notes/.cache/sources");
}

export function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

// Some doc sites are SPAs and return a near-empty shell on plain `fetch`.
// When we know the prose lives in a Git repo, rewrite to the raw markdown URL.
// Returns one or more URLs to try in order; the first non-empty success wins.
function rewriteForFetch(url: string): string[] {
  // docs.nestjs.com → raw markdown in nestjs/docs.nestjs.com on GitHub.
  // URL shape: https://docs.nestjs.com/<section>/<slug>[#anchor]
  const nest: RegExpExecArray | null =
    /^https?:\/\/docs\.nestjs\.com\/([^#?]+?)\/?(?:[#?].*)?$/.exec(url);
  if (nest !== null) {
    const path: string = nest[1]!;
    return [
      `https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/${path}.md`,
      url,
    ];
  }
  // GitHub blob viewer → raw file.
  // URL shape: https://github.com/<owner>/<repo>/blob/<ref>/<path>[#anchor]
  const ghBlob: RegExpExecArray | null =
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/([^#?]+)(?:[#?].*)?$/.exec(
      url,
    );
  if (ghBlob !== null) {
    const [, owner, repo, ref, path] = ghBlob;
    return [
      `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`,
      url,
    ];
  }
  // GitHub repo home → README on main, fall back to master.
  // URL shape: https://github.com/<owner>/<repo>[/]
  const ghRepo: RegExpExecArray | null =
    /^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)\/?$/.exec(url);
  if (ghRepo !== null) {
    const [, owner, repo] = ghRepo;
    return [
      `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
      `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
      url,
    ];
  }
  return [url];
}

// Strip URL fragments and trailing punctuation, then dedupe by canonical form.
// Two URLs that differ only by `#anchor` or `?query` point at the same source
// document; the verifier prompt only carries one extract per document anyway.
function canonicalUrl(url: string): string {
  return url
    .replace(/[)>,.;:!?'"]+$/g, "")
    .replace(/#.*$/, "")
    .replace(/\?.*$/, "")
    .replace(/\/$/, "");
}

function dedupeByCanonical(urls: readonly string[]): string[] {
  const seen: Set<string> = new Set();
  const out: string[] = [];
  for (const u of urls) {
    const key: string = canonicalUrl(u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}

// Extract every primary-source-looking URL in the note body (post-frontmatter).
// Captures both markdown-link form `[text](https://...)` and bare URLs in prose.
// Skips URLs in fenced code blocks (snippet placeholders, not citations) and
// internal localhost/example.com hosts.
export function extractInlineUrls(noteText: string): string[] {
  let body: string;
  if (noteText.startsWith("---\n")) {
    const closeIdx: number = noteText.indexOf("\n---", 4);
    body = closeIdx === -1 ? noteText : noteText.slice(closeIdx + 4);
  } else {
    body = noteText;
  }
  // Strip fenced code blocks so URLs inside snippets don't leak in as sources.
  const stripped: string = body.replace(/```[\s\S]*?```/g, " ");
  const urls: string[] = [];
  const re: RegExp = /https?:\/\/[^\s)>\]"']+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripped)) !== null) {
    const raw: string = match[0]!;
    const url: string = raw.replace(/[)>,.;:!?'"]+$/g, "");
    // Skip non-source hosts.
    if (/^https?:\/\/(localhost|127\.|example\.com|0\.0\.0\.0)/i.test(url))
      continue;
    urls.push(url);
  }
  return dedupeByCanonical(urls);
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

async function fetchOnce(
  fetchUrl: string,
  displayUrl: string,
): Promise<{ text: string; ok: boolean; reason?: string }> {
  const ctrl: AbortController = new AbortController();
  const timer: NodeJS.Timeout = setTimeout(
    () => ctrl.abort(),
    FETCH_TIMEOUT_MS,
  );
  try {
    const resp: Response = await fetch(fetchUrl, {
      signal: ctrl.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; kb-source-verifier/1.0; +https://github.com/losiochico/knowledge-base)",
        accept: "text/html,application/xhtml+xml,text/markdown,text/plain,*/*",
      },
      redirect: "follow",
    });
    if (!resp.ok) {
      return { text: "", ok: false, reason: `HTTP ${resp.status}` };
    }
    const ct: string = resp.headers.get("content-type") ?? "";
    const raw: string = await resp.text();
    const text: string = ct.includes("html") ? htmlToText(raw) : raw;
    if (text.length < 500 && ct.includes("html")) {
      return {
        text,
        ok: false,
        reason: `fetched only ${text.length} chars (likely SPA shell)`,
      };
    }
    void displayUrl;
    return { text, ok: true };
  } catch (err) {
    return {
      text: "",
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOne(url: string, repoRoot: string): Promise<FetchedSource> {
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

  const candidates: string[] = rewriteForFetch(url);
  const failures: string[] = [];
  for (const candidate of candidates) {
    const result = await fetchOnce(candidate, url);
    if (result.ok) {
      writeFileSync(path, result.text, "utf8");
      writeFileSync(
        meta,
        JSON.stringify({ url, fetchedFrom: candidate, fetchedAt: Date.now() }),
        "utf8",
      );
      return { url, text: result.text, fromCache: false };
    }
    failures.push(`${candidate}: ${result.reason ?? "unknown"}`);
  }

  // All candidates failed. Fall back to stale cache if present.
  if (existsSync(path)) {
    return {
      url,
      text: readFileSync(path, "utf8"),
      fromCache: true,
      error: `refetch failed (${failures.join("; ")}); using stale cache`,
    };
  }
  return {
    url,
    text: "",
    fromCache: false,
    error: failures.join("; "),
  };
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
      const truncated: boolean = s.text.length >= MAX_SOURCE_CHARS;
      const header: string =
        s.error !== undefined
          ? `[${idx + 1}] ${s.url}\n!! FETCH ERROR: ${s.error}`
          : `[${idx + 1}] ${s.url}${s.fromCache ? " (cached)" : ""}${truncated ? " (truncated)" : ""}`;
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
    "CITED SOURCES (extracted plain text from URLs cited by the note: frontmatter `source:` AND inline links in the body):",
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

// Cap concurrent agent sessions to avoid Cursor-side rate limits while still
// pipelining network + token-generation across files.
const SOURCE_VERIFY_CONCURRENCY: number = 4;

async function pMap<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next: number = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i: number = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  }
  const workers: Promise<void>[] = [];
  for (let i: number = 0; i < Math.min(limit, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

export async function runSourceVerifyPass(
  args: SourceVerifyArgs,
): Promise<FlatFinding[]> {
  const { repoRoot, targets, runAgent, extractJson, log } = args;
  const voteCfg = readVotingConfig();

  const perFile: FlatFinding[][] = await pMap(
    targets,
    SOURCE_VERIFY_CONCURRENCY,
    async (target: string): Promise<FlatFinding[]> => {
      const abs: string = resolve(repoRoot, target);
      if (!existsSync(abs)) {
        log(`[source-verify] skip (missing): ${target}`);
        return [];
      }
      const noteText: string = readFileSync(abs, "utf8");
      const fmUrls: string[] = extractSourceUrls(noteText);
      const inlineUrls: string[] = extractInlineUrls(noteText);
      const urls: string[] = dedupeByCanonical([...fmUrls, ...inlineUrls]);
      if (urls.length === 0) {
        log(`[source-verify] skip (no source URLs): ${target}`);
        return [];
      }
      const inlineOnly: number = urls.length - fmUrls.length;
      log(
        `[source-verify] ${target}: ${urls.length} source URL(s) (frontmatter=${fmUrls.length}, inline-only=${inlineOnly})`,
      );

      const sources: FetchedSource[] = await fetchSources(urls, repoRoot);
      const fetched: number = sources.filter(
        (s): boolean => s.error === undefined,
      ).length;
      const cached: number = sources.filter((s): boolean => s.fromCache).length;
      log(
        `[source-verify] ${target} fetched=${fetched - cached} cached=${cached} failed=${sources.length - fetched}`,
      );
      for (const s of sources) {
        if (s.error !== undefined) log(`  - ${s.url}: ${s.error}`);
      }

      const totalLines: number = noteText.split("\n").length;
      const prompt: string = buildVerifierPrompt(target, noteText, sources);

      const runOnce = async (sampleIdx: number): Promise<FlatFinding[]> => {
        const label: string =
          voteCfg.n > 1
            ? `source-verify:${target}#${sampleIdx + 1}`
            : `source-verify:${target}`;
        const text: string = await runAgent(prompt, label);
        let parsed: VerifierReport;
        try {
          parsed = JSON.parse(extractJson(text)) as VerifierReport;
        } catch (err) {
          log(
            `[source-verify] failed to parse response for ${target} (sample ${sampleIdx + 1}): ${err instanceof Error ? err.message : String(err)}`,
          );
          return [];
        }
        const out: FlatFinding[] = [];
        for (const f of parsed.findings ?? []) {
          if (f.line < 1 || f.line > totalLines) continue;
          const prefix: string =
            f.status === "contradicted"
              ? "Contradicts cited sources"
              : f.status === "unsourced-but-plausible"
                ? "Plausible but unsourced"
                : "Not supported by cited sources";
          const tail: string =
            f.status === "unsourced-but-plausible" &&
            f.suggestedSourceUrl !== undefined
              ? ` Suggested source: ${f.suggestedSourceUrl}`
              : "";
          out.push({
            rule: "source-verification",
            path: target,
            line: f.line,
            message: `${prefix}: ${f.claim}. ${f.explanation}${tail}`,
            ...(f.evidence !== undefined
              ? { evidence: f.evidence.slice(0, 120) }
              : {}),
          });
        }
        log(
          `[source-verify] ${target} sample ${sampleIdx + 1}: ${parsed.findings?.length ?? 0} finding(s)`,
        );
        return out;
      };

      // Signature: line + status prefix + first ~60 normalized chars of the
      // claim. Claim wording drifts more than jargon quotes, so we normalize
      // (lowercase, collapse non-alnum) before truncating to keep the same
      // claim across resamples in one bucket. Status prefix prevents
      // "contradicted" and "unsourced-but-plausible" findings on the same line
      // from colliding.
      const sigOf = (f: FlatFinding): string => {
        const prefixMatch: RegExpExecArray | null =
          /^(Contradicts cited sources|Plausible but unsourced|Not supported by cited sources):/.exec(
            f.message,
          );
        const status: string =
          prefixMatch !== null ? prefixMatch[1]! : "unknown";
        const claim: string = f.message
          .replace(
            /^(Contradicts cited sources|Plausible but unsourced|Not supported by cited sources):\s*/,
            "",
          )
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .slice(0, 60);
        return `${f.path}|${f.rule}|${f.line}|${status}|${claim}`;
      };

      return runWithVoting(voteCfg, runOnce, sigOf, log, target);
    },
  );

  return perFile.flat();
}
