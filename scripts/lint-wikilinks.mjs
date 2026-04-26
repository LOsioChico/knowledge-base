#!/usr/bin/env node
// Deterministic first-mention wikilink linter for the knowledge base.
//
// For every concept (note title + aliases) found anywhere in `content/`,
// the FIRST prose occurrence of that concept inside any OTHER note must be
// wrapped in a `[[wikilink]]`. Code blocks, inline code, frontmatter, and
// already-wikilinked occurrences are ignored.
//
// Exit 0 = clean. Exit 1 = violations (printed to stderr).

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../content", import.meta.url));
const REPO = fileURLToPath(new URL("..", import.meta.url));

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else if (entry.isFile() && p.endsWith(".md")) out.push(p);
  }
  return out;
}

function parseFrontmatter(src) {
  if (!src.startsWith("---\n")) return { fm: {}, body: src, bodyOffset: 0 };
  const end = src.indexOf("\n---\n", 4);
  if (end === -1) return { fm: {}, body: src, bodyOffset: 0 };
  const raw = src.slice(4, end);
  const body = src.slice(end + 5);
  const fm = {};
  let currentKey = null;
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      const v = m[2].trim();
      if (v.startsWith("[") && v.endsWith("]")) {
        fm[currentKey] = v
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (v) {
        fm[currentKey] = v;
      } else {
        fm[currentKey] = [];
      }
    } else if (line.startsWith("  - ") && currentKey) {
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
      fm[currentKey].push(line.slice(4).trim().replace(/^["']|["']$/g, ""));
    }
  }
  return { fm, body, bodyOffset: end + 5 };
}

// Mask code blocks, inline code, and existing wikilinks with spaces
// so position-based searches still report the original line/col but
// substring matches inside masked regions are skipped.
function maskNonProse(body) {
  let out = body;
  const masks = [
    /```[\s\S]*?```/g,    // fenced code
    /`[^`\n]+`/g,          // inline code
    /\[\[[^\]]+\]\]/g,     // existing wikilinks
    /\[[^\]]*\]\([^)]*\)/g,// markdown links
    /<!--[\s\S]*?-->/g,    // html comments
  ];
  for (const re of masks) {
    out = out.replace(re, (m) => " ".repeat(m.length));
  }
  return out;
}

function lineColFor(src, idx) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < idx; i++) {
    if (src[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$1");
}

const files = await walk(ROOT);
const notes = [];
for (const path of files) {
  const src = await readFile(path, "utf8");
  const { fm, body, bodyOffset } = parseFrontmatter(src);
  // Wikilink target = path relative to content/, no extension, forward slashes
  const rel = relative(ROOT, path).split(sep).join("/").replace(/\.md$/, "");
  const slug = rel; // full slug, e.g. nestjs/fundamentals/pipes
  const baseName = rel.split("/").pop();
  notes.push({
    path,
    rel,
    slug,
    baseName,
    title: typeof fm.title === "string" ? fm.title : null,
    aliases: Array.isArray(fm.aliases) ? fm.aliases : [],
    src,
    body,
    bodyOffset,
    masked: maskNonProse(body),
  });
}

// Build concept catalog. Each entry: { term, slug }
// Skip "index" notes — too generic to match prose ("index", "recipes/index").
const concepts = [];
for (const n of notes) {
  if (n.baseName === "index") continue;
  const terms = new Set();
  if (n.title) terms.add(n.title);
  for (const a of n.aliases) terms.add(a);
  // Use the file basename too (e.g., "pipes", "interceptors")
  terms.add(n.baseName.replace(/-/g, " "));
  for (const t of terms) {
    if (!t || t.length < 3) continue;
    concepts.push({ term: t, slug: n.slug });
  }
}

// Sort longer terms first so multi-word matches win over single words
concepts.sort((a, b) => b.term.length - a.term.length);

const violations = [];

for (const n of notes) {
  // Track which concept slugs are already linked anywhere in this note.
  // Quartz resolves partial paths, so `[[guards]]` matches any slug ending in `/guards`.
  const linkedTargets = new Set();
  for (const m of n.body.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
    linkedTargets.add(m[1].trim().replace(/^\.\.?\//, "").replace(/\/$/, ""));
  }
  const isLinked = (slug) => {
    if (linkedTargets.has(slug)) return true;
    for (const t of linkedTargets) {
      if (slug === t || slug.endsWith("/" + t)) return true;
    }
    return false;
  };
  // Also count `related:` frontmatter targets — those count as "linked context"
  // but we still want the FIRST PROSE mention to be a wikilink, so we don't
  // skip just because related: lists it.

  for (const { term, slug } of concepts) {
    if (slug === n.slug) continue;       // don't link to self
    if (isLinked(slug)) continue;  // already linked somewhere — fine
    // Match whole word, case-insensitive, in masked body
    const re = new RegExp(`\\b${escapeRe(term)}\\b`, "i");
    const match = n.masked.match(re);
    if (!match) continue;
    const idx = match.index;
    const { line, col } = lineColFor(n.body, idx);
    const absLine = line + n.body.slice(0, n.bodyOffset).split("\n").length - 1;
    violations.push({
      file: relative(REPO, n.path),
      line: absLine,
      col,
      term,
      target: slug,
    });
  }
}

if (violations.length === 0) {
  console.log("✓ wikilink linter: all first mentions are linked");
  process.exit(0);
}

console.error(`✗ wikilink linter: ${violations.length} first-mention violation(s)\n`);
const byFile = new Map();
for (const v of violations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}
for (const [file, list] of byFile) {
  console.error(`  ${file}`);
  for (const v of list) {
    console.error(
      `    L${v.line}: "${v.term}" should link to [[${v.target}|${v.term}]]`,
    );
  }
}
console.error("\nFix by wrapping the first prose mention in a wikilink, OR add it to `related:` and link it later in the body.");
process.exit(1);
