#!/usr/bin/env node
/**
 * lint-mermaid-wikilinks.mjs — Deterministic Mermaid wikilink check
 *
 * Finds Mermaid code blocks that contain Obsidian wikilinks ([[slug|Label]]).
 * Mermaid doesn't understand wikilinks — they render as literal bracket text.
 * Use plain text labels + `click NODE "/knowledge-base/slug/"` directives instead.
 *
 * Run:  node scripts/lint-mermaid-wikilinks.mjs
 * CI:   wired into `lint:ci:tooling`
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

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

const files = await walkMdx(docsRoot);
/** @type {{ file: string; line: number; wikilink: string }[]} */
const errors = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const rel = relative(repoRoot, file).replace(/\\/g, "/");
  const lines = text.split("\n");

  let inMermaid = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed.startsWith("```mermaid")) {
      inMermaid = true;
      continue;
    }
    if (inMermaid && trimmed.startsWith("```")) {
      inMermaid = false;
      continue;
    }

    if (inMermaid) {
      let match;
      WIKILINK_RE.lastIndex = 0;
      while ((match = WIKILINK_RE.exec(line)) !== null) {
        errors.push({
          file: rel,
          line: i + 1,
          wikilink: match[0],
        });
      }
    }
  }
}

if (errors.length) {
  console.error(
    `✗ mermaid-wikilinks: ${errors.length} wikilink(s) found inside Mermaid blocks\n`,
  );
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line}`);
    console.error(`    found: ${e.wikilink}`);
    console.error(
      `    fix:   use plain text label + click directive instead\n`,
    );
  }
  console.error(
    `  Mermaid renders [[ ]] as literal text. Use plain labels and:\n`,
  );
  console.error(
    `    click NODE "/knowledge-base/slug/" for clickable navigation.\n`,
  );
  process.exit(1);
}

console.log(
  `✓ mermaid-wikilinks: ${files.length} file(s), no wikilinks inside Mermaid blocks`,
);
