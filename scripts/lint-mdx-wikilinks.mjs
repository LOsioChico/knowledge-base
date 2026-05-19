#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectDocSlugs,
  resolveWikilinkTarget,
} from "../sites/docs/src/plugins/doc-slugs.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const docsRoot = join(repoRoot, "sites/docs/src/content/docs");

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;

async function walkMdx(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMdx(path)));
    else if (entry.name.endsWith(".mdx")) files.push(path);
  }
  return files;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

const slugs = collectDocSlugs(docsRoot);
const files = await walkMdx(docsRoot);
/** @type {{ file: string, line: number, raw: string, target: string }[]} */
const errors = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const rel = relative(docsRoot, file).replace(/\\/g, "/");
  for (const match of text.matchAll(WIKILINK_RE)) {
    const target = match[1].trim();
    if (target.includes("`")) {
      errors.push({
        file: rel,
        line: lineOf(text, match.index ?? 0),
        raw: match[0],
        target,
      });
      continue;
    }
    if (!resolveWikilinkTarget(target, slugs)) {
      errors.push({
        file: rel,
        line: lineOf(text, match.index ?? 0),
        raw: match[0],
        target,
      });
    }
  }
}

if (errors.length === 0) {
  console.log(`✓ mdx wikilinks: ${files.length} file(s), all [[ ]] targets resolve`);
  process.exit(0);
}

console.error(`✗ mdx wikilinks: ${errors.length} unresolved target(s)\n`);
for (const e of errors) {
  const reason = e.raw.includes("`")
    ? "backticks inside [[ ]] (forbidden)"
    : `no doc slug for "${e.target}"`;
  console.error(`  ${e.file}:${e.line}  ${e.raw}  (${reason})`);
}
console.error("\nKnown slugs:", [...slugs].sort().join(", "));
process.exit(1);
