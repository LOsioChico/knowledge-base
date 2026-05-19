#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const docsRoot = join(repoRoot, "sites/docs/src/content/docs");

const SITE_HREF_RE =
  /https:\/\/losiochico\.github\.io\/knowledge-base\/([a-z0-9][a-z0-9/-]*[a-z0-9]|[a-z0-9])?\/?/gi;

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
async function loadPublishedSlugs() {
  const files = await walkMdx(docsRoot);
  /** @type {Set<string>} */
  const slugs = new Set();
  for (const file of files) {
    let rel = relative(docsRoot, file).replace(/\\/g, "/").replace(/\.mdx$/, "");
    if (rel === "index") rel = "";
    else if (rel.endsWith("/index")) rel = rel.slice(0, -6);
    slugs.add(rel);
  }
  return slugs;
}

const publishedSlugs = await loadPublishedSlugs();
const files = await walkMdx(docsRoot);
/** @type {{ file: string, line: number, slug: string, url: string, hasMdx: boolean }[]} */
const warnings = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const rel = relative(docsRoot, file).replace(/\\/g, "/");

  for (const match of text.matchAll(SITE_HREF_RE)) {
    const slug = (match[1] ?? "").replace(/\/$/, "");
    warnings.push({
      file: rel,
      line: lineOf(text, match.index ?? 0),
      slug,
      url: match[0],
      hasMdx: publishedSlugs.has(slug),
    });
  }
}

if (warnings.length === 0) {
  console.log(
    `✓ mdx link hygiene: ${files.length} file(s), no full-site URLs in MDX (use [[slug|label]])`,
  );
  process.exit(0);
}

console.warn(
  `⚠ mdx link hygiene: ${warnings.length} full-site URL(s) in MDX — use wikilinks or remove\n`,
);
for (const w of warnings) {
  const hint = w.hasMdx
    ? `→ prefer [[${w.slug || "home"}|…]]`
    : `→ no MDX at sites/docs/.../${w.slug || ""} — add an MDX page, mark "planned" in prose, or drop the link`;
  console.warn(`  ${w.file}:${w.line}  ${w.url}\n    ${hint}\n`);
}

if (strict) {
  console.error("\nMDX internal links must use [[slug|label]] (see docs/PUBLISHING.md).");
  process.exit(1);
}

console.warn("\n(advisory only; lint:docs uses --strict)");
process.exit(0);
