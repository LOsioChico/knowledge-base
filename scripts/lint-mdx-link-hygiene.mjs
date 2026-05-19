#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const docsRoot = join(repoRoot, "sites/docs/src/content/docs");
const migrationPath = join(repoRoot, "sites/docs/migration.json");

const QUARTZ_HREF_RE =
  /https:\/\/losiochico\.github\.io\/knowledge-base\/([a-z0-9][a-z0-9/-]*[a-z0-9]|[a-z0-9])\/?/gi;

const strict = process.argv.includes("--strict");

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

/** @returns {Set<string>} */
async function loadMigratedSlugs() {
  const raw = await readFile(migrationPath, "utf8");
  const data = JSON.parse(raw);
  /** @type {Set<string>} */
  const slugs = new Set();
  for (const area of Object.values(data.areas ?? {})) {
    for (const note of Object.values(area.notes ?? {})) {
      if (note.status === "migrated" && note.slug) slugs.add(note.slug);
    }
  }
  return slugs;
}

const migratedSlugs = await loadMigratedSlugs();
const files = await walkMdx(docsRoot);
/** @type {{ file: string, line: number, slug: string, url: string }[]} */
const warnings = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const rel = relative(docsRoot, file).replace(/\\/g, "/");

  for (const match of text.matchAll(QUARTZ_HREF_RE)) {
    const slug = match[1].replace(/\/$/, "");
    if (!migratedSlugs.has(slug)) continue;

    warnings.push({
      file: rel,
      line: lineOf(text, match.index ?? 0),
      slug,
      url: match[0],
    });
  }
}

if (warnings.length === 0) {
  console.log(
    `✓ mdx link hygiene: ${files.length} file(s), no Quartz URLs pointing at migrated Starlight slugs`,
  );
  process.exit(0);
}

console.warn(
  `⚠ mdx link hygiene: ${warnings.length} Quartz URL(s) should be wikilinks (migrated on Starlight)\n`,
);
for (const w of warnings) {
  console.warn(
    `  ${w.file}:${w.line}  ${w.url}\n` +
      `    → prefer [[${w.slug}|…]] or /knowledge-base/${w.slug}/ in prose\n`,
  );
}

if (strict) {
  console.error("\nUse wikilinks for migrated slugs (see docs/STARLIGHT-FEATURES.md).");
  process.exit(1);
}

console.warn("\n(advisory only; CI and lint:docs use --strict)");
process.exit(0);
