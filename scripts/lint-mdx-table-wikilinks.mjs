#!/usr/bin/env node
/**
 * MDX tables use `|` as column delimiters. Wikilinks with aliases (`[[slug|label]]`)
 * split the cell and render as broken text. Use `[label](/knowledge-base/slug/)` in tables.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const docsRoot = join(repoRoot, "sites/docs/src/content/docs");

const TABLE_WIKILINK_ALIAS_RE = /^\s*\|.*\[\[[^\]|]+\|[^\]]+\]\]/;

async function walkMdx(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMdx(path)));
    else if (entry.name.endsWith(".mdx")) files.push(path);
  }
  return files;
}

const files = await walkMdx(docsRoot);
/** @type {{ file: string; line: number; text: string }[]} */
const errors = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const rel = relative(repoRoot, file).replace(/\\/g, "/");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (TABLE_WIKILINK_ALIAS_RE.test(lines[i])) {
      errors.push({ file: rel, line: i + 1, text: lines[i].trim() });
    }
  }
}

if (errors.length) {
  console.error(
    `✗ mdx table wikilinks: ${errors.length} row(s) use [[slug|label]] inside a table (pipe breaks columns)\n`,
  );
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line}`);
    console.error(`    ${e.text}`);
    console.error(
      `    → use [label](/knowledge-base/slug/) or move the link out of the table\n`,
    );
  }
  process.exit(1);
}

console.log(
  `✓ mdx table wikilinks: ${files.length} file(s), no aliased [[ ]] inside table rows`,
);
