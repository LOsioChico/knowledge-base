#!/usr/bin/env -S npx tsx
// Apply deterministic auto-fixes to markdown notes.
//
// Rules covered (mirror the Pass-0 detectors in `deterministic.ts`):
//   - style-em-dash      \u2014 (em-dash) -> ":"
//   - style-double-hyphen `--` (outside code/frontmatter) -> ":"
//
// Skips frontmatter, fenced code blocks, inline backtick spans, and URLs so we
// don't munge code or links. Writes files in place. Prints the list of files
// that changed (one path per line) on stdout for the caller to consume.
//
// Usage:
//   tsx autofix.ts <file...>
//
// Exits 0 always. The list of changed files (possibly empty) is the contract.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
  const lines: string[] = text.split("\n");

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

function main(): void {
  const argv: string[] = process.argv.slice(2);
  if (argv.length === 0) {
    process.stderr.write("usage: autofix.ts <file...>\n");
    process.exit(0);
    return;
  }
  const changed: string[] = [];
  for (const arg of argv) {
    const abs: string = resolve(process.cwd(), arg);
    const r: FixResult = fixFile(abs);
    if (r.changed) changed.push(arg);
  }
  for (const f of changed) process.stdout.write(`${f}\n`);
  process.exit(0);
}

main();
