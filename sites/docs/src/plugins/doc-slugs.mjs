import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Collect Starlight doc slugs from src/content/docs (mirrors Astro route IDs).
 * @param {string} docsRoot absolute path to src/content/docs
 * @returns {Set<string>}
 */
export function collectDocSlugs(docsRoot) {
  /** @type {Set<string>} */
  const slugs = new Set();

  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.mdx?$/.test(name)) continue;

      const rel = relative(docsRoot, path).replace(/\\/g, "/");
      const withoutExt = rel.replace(/\.mdx?$/, "");
      if (name.startsWith("index.")) {
        const parent = relative(docsRoot, dir).replace(/\\/g, "/");
        if (parent && parent !== ".") slugs.add(parent);
      } else {
        slugs.add(withoutExt);
      }
    }
  }

  walk(docsRoot);
  return slugs;
}

/**
 * Resolve Obsidian-style wikilink target to a doc slug (no leading slash).
 * @param {string} target raw target inside [[ ]]
 * @param {Set<string>} slugs
 * @returns {string | null}
 */
export function resolveWikilinkTarget(target, slugs) {
  let name = target.trim().replace(/^\//, "").replace(/\.mdx?$/, "");
  if (!name) return null;

  if (slugs.has(name)) return name;

  // Vault-style area index: [[effect-ts/]] → effect-ts
  if (name.endsWith("/")) {
    name = name.slice(0, -1);
    if (slugs.has(name)) return name;
  }

  const basename = name.includes("/") ? name.split("/").pop() : name;
  const matches = [...slugs].filter(
    (s) => s === name || s.endsWith(`/${basename}`) || s.split("/").pop() === basename,
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const exact = matches.filter((s) => s === name || s.endsWith(`/${name}`));
    if (exact.length === 1) return exact[0];
  }
  return null;
}
