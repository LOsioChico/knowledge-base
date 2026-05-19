import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { collectDocSlugs, resolveWikilinkTarget } from "./doc-slugs.mjs";

/**
 * Map an absolute MDX path under docsRoot to a Starlight slug.
 * @param {string} docsRoot
 * @param {string} absPath
 * @returns {string | null}
 */
export function filePathToSlug(docsRoot, absPath) {
  const rel = relative(docsRoot, absPath).replace(/\\/g, "/");
  if (!/\.mdx?$/.test(rel)) return null;
  const name = rel.split("/").pop() ?? "";
  const withoutExt = rel.replace(/\.mdx?$/, "");
  if (/^index\.mdx?$/.test(name)) {
    const parent = relative(docsRoot, dirname(absPath)).replace(/\\/g, "/");
    if (!parent || parent === ".") return "";
    return parent;
  }
  return withoutExt;
}

/**
 * @param {string} text
 * @param {Set<string>} slugs
 * @param {string} base e.g. `/knowledge-base`
 * @returns {Set<string>}
 */
export function extractOutboundSlugs(text, slugs, base) {
  /** @type {Set<string>} */
  const out = new Set();
  const basePath = base.replace(/\/$/, "");

  for (const m of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const slug = resolveWikilinkTarget(m[1], slugs);
    if (slug) out.add(slug);
  }

  const internalRe = new RegExp(
    `\\]\\(\\s*(?:${escapeRe(basePath)})?/([^)\\s#]+(?:/[^)\\s#]+)*)/?\\s*(?:#[^)]*)?\\)`,
    "g",
  );
  for (const m of text.matchAll(internalRe)) {
    const slug = m[1].replace(/\/$/, "");
    if (slugs.has(slug)) out.add(slug);
  }

  return out;
}

/**
 * @param {string} docsRoot absolute path to src/content/docs
 * @param {string} [base]
 * @returns {Record<string, string[]>}
 */
export function buildBacklinkIndex(docsRoot, base = "") {
  const slugs = collectDocSlugs(docsRoot);
  /** @type {Map<string, Set<string>>} */
  const inbound = new Map();

  /** @type {string[]} */
  const files = [];
  walkMdxFiles(docsRoot, files);

  for (const abs of files) {
    const fromSlug = filePathToSlug(docsRoot, abs);
    if (fromSlug === null) continue;
    const text = readFileSync(abs, "utf8");
    for (const toSlug of extractOutboundSlugs(text, slugs, base)) {
      if (toSlug === fromSlug) continue;
      if (!inbound.has(toSlug)) inbound.set(toSlug, new Set());
      inbound.get(toSlug).add(fromSlug);
    }
  }

  /** @type {Record<string, string[]>} */
  const index = {};
  for (const [slug, set] of inbound) {
    index[slug] = [...set].sort();
  }
  return index;
}

/**
 * @param {string} dir
 * @param {string[]} out
 */
function walkMdxFiles(dir, out) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walkMdxFiles(path, out);
      continue;
    }
    if (name.endsWith(".mdx") || name.endsWith(".md")) out.push(path);
  }
}

/** @param {string} s */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
