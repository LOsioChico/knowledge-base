#!/usr/bin/env node
/**
 * lint-ec-titles.mjs — Deterministic Expressive Code title check
 *
 * Finds TypeScript/JS code blocks where the first line is a `// filename.ext`
 * comment that should be a `title="filename.ext"` annotation on the fence.
 *
 * Run:  node scripts/lint-ec-titles.mjs
 * CI:   wired into `lint:ci:tooling`
 * Fix:  the pre-commit autofixer (`pre-commit-autofix.ts`) converts these
 *       automatically, so this lint only fires when the autofixer was bypassed.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const docsRoot = join(repoRoot, "sites/docs/src/content/docs");

/** Walk recursively and collect .mdx files. */
async function walkMdx(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMdx(path)));
    else if (entry.name.endsWith(".mdx")) files.push(path);
  }
  return files;
}

/**
 * Filename pattern: `// filename.ext` or `// path/to/filename.ext`
 * Must end with a known extension (1-5 chars).
 */
const FILENAME_COMMENT_RE = /^\/\/\s+([\w./-]+\.[a-z]{1,5})\s*$/;

/**
 * Opening fence for any code block (with optional indentation).
 * Captures: indent, lang, rest-of-line (attrs).
 * We check all languages because title= applies to json, yaml, etc. too.
 */
const FENCE_OPEN_RE = /^(\s*)```(\w+)(.*?)$/;

const files = await walkMdx(docsRoot);
/** @type {{ file: string; line: number; comment: string; suggestedTitle: string }[]} */
const errors = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const rel = relative(repoRoot, file).replace(/\\/g, "/");
  const lines = text.split("\n");

  for (let i = 0; i < lines.length - 1; i++) {
    const fenceMatch = FENCE_OPEN_RE.exec(lines[i]);
    if (!fenceMatch) continue;

    const attrs = fenceMatch[3].trim();
    // Skip if already has title=
    if (attrs.includes("title=")) continue;
    // Skip twoslash blocks
    if (attrs.includes("twoslash")) continue;

    // Check if the next line is a // filename comment
    const nextLine = lines[i + 1].replace(/^\s+/, ""); // strip leading indent
    const commentMatch = FILENAME_COMMENT_RE.exec(nextLine);
    if (!commentMatch) continue;

    const filename = commentMatch[1];
    errors.push({
      file: rel,
      line: i + 1,
      comment: nextLine.trim(),
      suggestedTitle: filename,
    });
  }
}

if (errors.length) {
  console.error(
    `✗ ec-titles: ${errors.length} code block(s) have a // filename comment that should be a title= annotation\n`,
  );
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line}`);
    console.error(`    found:    ${e.comment}`);
    console.error(
      `    expected: title="${e.suggestedTitle}" on the fence line (remove the comment)\n`,
    );
  }
  console.error(
    `  Fix: run the pre-commit autofixer or manually move the comment to title="..." on the opening fence.\n`,
  );
  process.exit(1);
}

console.log(
  `✓ ec-titles: ${files.length} file(s), no // filename comments in code blocks`,
);
