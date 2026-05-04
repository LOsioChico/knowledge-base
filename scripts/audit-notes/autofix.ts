#!/usr/bin/env -S npx tsx
// Apply deterministic auto-fixes to markdown notes.
//
// Rules covered (mirror the Pass-0 detectors in `deterministic.ts` and the
// `source-list-completeness` check in `lint-wikilinks-core.mjs`):
//   - style-em-dash             \u2014 (em-dash) -> ":"
//   - style-double-hyphen       `--` (outside code/frontmatter) -> ":"
//   - source-list-completeness  remove `source:` URLs absent from body
//
// Skips frontmatter, fenced code blocks, inline backtick spans, and URLs so we
// don't munge code or links. Writes files in place. Prints the list of files
// that changed (one path per line) on stdout for the caller to consume.
//
// Usage:
//   tsx autofix.ts <file...>
//
// Exits 0 always. The list of changed files (possibly empty) is the contract.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface FixResult {
  changed: boolean;
  out: string;
}

function fixLine(line: string): string {
  // Replace inside-text-only spans by walking backtick segments.
  // Anything inside a backtick span is preserved verbatim.
  const parts: string[] = [];
  let i: number = 0;
  while (i < line.length) {
    const tickAt: number = line.indexOf("`", i);
    if (tickAt === -1) {
      parts.push(applyOutsideCode(line.slice(i)));
      break;
    }
    parts.push(applyOutsideCode(line.slice(i, tickAt)));
    const closeAt: number = line.indexOf("`", tickAt + 1);
    if (closeAt === -1) {
      // Unterminated backtick: treat the rest as code (defensive).
      parts.push(line.slice(tickAt));
      break;
    }
    parts.push(line.slice(tickAt, closeAt + 1));
    i = closeAt + 1;
  }
  return parts.join("");
}

function applyOutsideCode(s: string): string {
  let out: string = s;

  // 1. Em-dash. Common shapes:
  //      "foo \u2014 bar"  -> "foo: bar"
  //      "foo\u2014bar"    -> "foo: bar"   (rare; still safer than ":")
  //      "\u2014 bar"      -> ": bar"
  out = out.replace(/\s*\u2014\s*/g, ": ");

  // 2. Double-hyphen used as a dash. Detector requires non-hyphen on both sides
  //    (so `--flag` and `---` separators stay intact). Mirror that.
  out = out.replace(/(^|[^-])--(?=[^-])/g, (_m: string, pre: string): string =>
    pre.length > 0 ? `${pre}: ` : ": ",
  );

  return out;
}

function fixFile(absPath: string): FixResult {
  const text: string = readFileSync(absPath, "utf8");
  let lines: string[] = text.split("\n");

  lines = stripOrphanSources(lines);

  let inFrontmatter: boolean = false;
  let inFence: boolean = false;
  const out: string[] = new Array<string>(lines.length);

  for (let i: number = 0; i < lines.length; i++) {
    const raw: string = lines[i] ?? "";

    if (i === 0 && raw === "---") {
      inFrontmatter = true;
      out[i] = raw;
      continue;
    }
    if (inFrontmatter) {
      if (raw === "---") inFrontmatter = false;
      out[i] = raw;
      continue;
    }
    if (/^\s{0,3}(```|~~~)/.test(raw)) {
      inFence = !inFence;
      out[i] = raw;
      continue;
    }
    if (inFence) {
      out[i] = raw;
      continue;
    }

    out[i] = fixLine(raw);
  }

  const next: string = out.join("\n");
  if (next === text) return { changed: false, out: next };
  writeFileSync(absPath, next, "utf8");
  return { changed: true, out: next };
}

// Strip `source:` block-list entries whose URL doesn't appear anywhere in the
// note body. Block form only:
//
//   source:
//     - https://...
//     - https://...
//
// Both sides are normalized (fragment + trailing slash stripped) so anchored
// inline links satisfy file-level frontmatter entries.
//
// Skips when:
//   - no frontmatter or no `source:` key
//   - `source:` uses flow form (`source: [...]`); too rare to be worth parsing
function stripOrphanSources(lines: string[]): string[] {
  if (lines[0] !== "---") return lines;
  let fmEnd: number = -1;
  for (let i: number = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      fmEnd = i;
      break;
    }
  }
  if (fmEnd === -1) return lines;

  let sourceStart: number = -1;
  for (let i: number = 1; i < fmEnd; i++) {
    if (/^source:\s*$/.test(lines[i] ?? "")) {
      sourceStart = i;
      break;
    }
  }
  if (sourceStart === -1) return lines;

  // Collect block-list lines: `  - <url>` (any indent ≥ 2 spaces, dash, space).
  let sourceEnd: number = sourceStart;
  for (let i: number = sourceStart + 1; i < fmEnd; i++) {
    const ln: string = lines[i] ?? "";
    if (/^\s+-\s+/.test(ln)) {
      sourceEnd = i;
    } else if (ln.trim() === "") {
      // Allow blank lines inside the block conservatively as terminators.
      break;
    } else {
      break;
    }
  }
  if (sourceEnd === sourceStart) return lines;

  const body: string = lines.slice(fmEnd + 1).join("\n");
  const bodyUrls: Set<string> = new Set<string>();
  const urlRe = /https?:\/\/[^\s)\]"'<>]+/g;
  for (const m of body.matchAll(urlRe)) {
    bodyUrls.add(normalizeUrl(m[0]));
  }

  const itemRe = /^(\s+-\s+)(.+?)\s*$/;
  const kept: string[] = [];
  let changed: boolean = false;
  for (let i: number = sourceStart + 1; i <= sourceEnd; i++) {
    const ln: string = lines[i] ?? "";
    const m = itemRe.exec(ln);
    if (!m || m[2] === undefined) {
      kept.push(ln);
      continue;
    }
    const raw: string = m[2].replace(/^["']|["']$/g, "");
    if (!/^https?:\/\//.test(raw)) {
      kept.push(ln);
      continue;
    }
    if (bodyUrls.has(normalizeUrl(raw))) {
      kept.push(ln);
    } else {
      changed = true;
    }
  }
  if (!changed) return lines;

  return [
    ...lines.slice(0, sourceStart + 1),
    ...kept,
    ...lines.slice(sourceEnd + 1),
  ];
}

function normalizeUrl(u: string): string {
  // Mirrors `normalizeAnyUrl` in `quartz/scripts/lint-wikilinks-core.mjs`:
  // strip fragment, trailing markdown punctuation, and a single trailing
  // slash so prose like `see https://x/y/z.` matches the bare frontmatter
  // entry `https://x/y/z`.
  const noFrag: string = u.split("#")[0] ?? u;
  return noFrag.replace(/[.,;:]+$/, "").replace(/\/$/, "");
}

function main(): void {
  const argv: string[] = process.argv.slice(2);
  let targets: string[];
  if (argv.length === 0) {
    // No args: walk content/ from the repo root (this file lives at
    // scripts/audit-notes/autofix.ts, so ../../content is the vault).
    const repoRoot: string = resolve(
      fileURLToPath(new URL("../..", import.meta.url)),
    );
    const contentRoot: string = join(repoRoot, "content");
    targets = [];
    walkMarkdown(contentRoot, targets);
  } else {
    targets = argv.map((a) => resolve(process.cwd(), a));
  }
  const changed: string[] = [];
  for (const abs of targets) {
    const r: FixResult = fixFile(abs);
    if (r.changed) changed.push(abs);
  }
  for (const f of changed) process.stdout.write(`${f}\n`);
  process.exit(0);
}

function walkMarkdown(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full: string = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkMarkdown(full, out);
    else if (st.isFile() && entry.endsWith(".md")) out.push(full);
  }
}

main();
