#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectDocSlugs,
  resolveWikilinkTarget,
} from "../sites/docs/src/plugins/doc-slugs.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const docsRoot = join(repoRoot, "sites/docs/src/content/docs");
const scriptDir = dirname(fileURLToPath(import.meta.url));

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

// ---------------------------------------------------------------------------
// Cross-area link check helpers
// ---------------------------------------------------------------------------

/**
 * Load the allowlist for cross-area wikilinks.
 * Format: [{ file: "area/note.mdx", target: "other-area/slug", display: "word" }]
 */
function loadCrossAreaAllowlist() {
  const path = join(scriptDir, "cross-area-allowlist.json");
  if (!existsSync(path)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return new Set(
      (Array.isArray(raw) ? raw : []).map(
        (entry) => `${entry.file}::${entry.target}`,
      ),
    );
  } catch {
    return new Set();
  }
}

/**
 * Parse line ranges for "See also" sections and Prerequisite Aside blocks.
 * Returns array of { startLine, endLine } (1-indexed, inclusive).
 */
function parseCrossAreaExcludedRegions(text) {
  const regions = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    // ## See also → extends to next heading or EOF
    if (/^#{1,6}\s+See\s+also/i.test(lines[i])) {
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{1,6}\s/.test(lines[j])) {
          end = j;
          break;
        }
      }
      regions.push({ startLine: i + 1, endLine: end });
    }
    // <Aside title="Prerequisites"> → extends to </Aside>
    if (/<Aside[^>]*title\s*=\s*["']Prerequisites["']/i.test(lines[i])) {
      let end = lines.length;
      for (let j = i; j < lines.length; j++) {
        if (/<\/Aside>/i.test(lines[j])) {
          end = j + 1;
          break;
        }
      }
      regions.push({ startLine: i + 1, endLine: end });
    }
  }
  return regions;
}

/**
 * Check if a line number falls within any excluded region.
 */
function isInExcludedRegion(line, regions) {
  return regions.some((r) => line >= r.startLine && line <= r.endLine);
}

/**
 * Determine if a wikilink match is in the frontmatter section.
 */
function isInFrontmatter(text, index) {
  if (!text.startsWith("---\n")) return false;
  const fmEnd = text.indexOf("\n---\n", 4);
  return fmEnd !== -1 && index < fmEnd + 5;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const slugs = collectDocSlugs(docsRoot);
const files = await walkMdx(docsRoot);
/** @type {{ file: string, line: number, raw: string, target: string }[]} */
const errors = [];
/** @type {{ file: string, line: number, raw: string, target: string, display: string }[]} */
const crossAreaErrors = [];

const allowSet = loadCrossAreaAllowlist();

for (const file of files) {
  const text = await readFile(file, "utf8");
  const rel = relative(docsRoot, file).replace(/\\/g, "/");
  const bn = basename(file, ".mdx");

  // Cross-area exclusions: skip index/MOC and comparison notes
  const isIndex = bn === "index";
  const isComparison = bn.includes("-vs-");
  const excludedRegions =
    !isIndex && !isComparison ? parseCrossAreaExcludedRegions(text) : [];
  const fileArea = rel.split("/")[0];

  for (const match of text.matchAll(WIKILINK_RE)) {
    const target = match[1].trim();
    const display = match[2]?.trim() ?? "";
    const line = lineOf(text, match.index ?? 0);

    // --- Existing checks: backticks and unresolved targets ---
    if (target.includes("`")) {
      errors.push({ file: rel, line, raw: match[0], target });
      continue;
    }
    if (!resolveWikilinkTarget(target, slugs)) {
      errors.push({ file: rel, line, raw: match[0], target });
    }

    // --- Cross-area link check ---
    if (isIndex || isComparison) continue;
    if (isInFrontmatter(text, match.index ?? 0)) continue;

    const targetArea = target.split("/")[0];
    if (targetArea === fileArea) continue;

    // Single-word display text?
    const effectiveDisplay = display || target.split("/").pop();
    if (effectiveDisplay.includes(" ")) continue;

    // In excluded region?
    if (isInExcludedRegion(line, excludedRegions)) continue;

    // In allowlist?
    const allowKey = `${rel}::${target}`;
    if (allowSet.has(allowKey)) continue;

    crossAreaErrors.push({
      file: rel,
      line,
      raw: match[0],
      target,
      display: effectiveDisplay,
    });
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

let exitCode = 0;

if (errors.length === 0) {
  console.log(
    `✓ mdx wikilinks: ${files.length} file(s), all [[ ]] targets resolve`,
  );
} else {
  console.error(`✗ mdx wikilinks: ${errors.length} unresolved target(s)\n`);
  for (const e of errors) {
    const reason = e.raw.includes("`")
      ? "backticks inside [[ ]] (forbidden)"
      : `no doc slug for "${e.target}"`;
    console.error(`  ${e.file}:${e.line}  ${e.raw}  (${reason})`);
  }
  console.error("\nKnown slugs:", [...slugs].sort().join(", "));
  exitCode = 1;
}

if (crossAreaErrors.length === 0) {
  console.log(
    "✓ cross-area-links: no single-word cross-area wikilinks in body text",
  );
} else {
  console.error(
    `\n✗ cross-area-links: ${crossAreaErrors.length} single-word cross-area wikilink(s)\n`,
  );
  for (const e of crossAreaErrors) {
    console.error(
      `  ${e.file}:${e.line}  ${e.raw}  → use multi-word display (e.g. "Effect Platform" instead of "${e.display}") or add to cross-area-allowlist.json`,
    );
  }
  exitCode = 1;
}

process.exit(exitCode);
