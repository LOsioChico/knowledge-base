#!/usr/bin/env node
/**
 * Ensures every legacy vault note under content/ (except inbox) has an MDX sibling
 * under sites/docs/src/content/docs/. MDX-only pages are allowed because the
 * published site is canonical and content/ is legacy parity coverage only.
 */

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const VAULT_SKIP = new Set(["inbox.md"]);

function walkMd(dir, base = dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkMd(abs, base));
    else if (ent.name.endsWith(".md")) {
      const rel = relative(base, abs).replaceAll("\\", "/");
      if (!VAULT_SKIP.has(rel)) out.push(rel.replace(/\.md$/, ""));
    }
  }
  return out.sort();
}

function walkMdx(dir, base = dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkMdx(abs, base));
    else if (ent.name.endsWith(".mdx")) {
      const rel = relative(base, abs).replaceAll("\\", "/");
      out.push(rel.replace(/\.mdx$/, ""));
    }
  }
  return out.sort();
}

function diff(a, b) {
  const setB = new Set(b);
  const setA = new Set(a);
  return {
    onlyA: a.filter((x) => !setB.has(x)),
    onlyB: b.filter((x) => !setA.has(x)),
  };
}

export function checkPublishParity(repoRoot = REPO_ROOT) {
  const vaultRoot = join(repoRoot, "content");
  const mdxRoot = join(repoRoot, "sites/docs/src/content/docs");

  const hasVault = existsSync(vaultRoot);
  if (!existsSync(mdxRoot)) {
    return { ok: false, errors: ["sites/docs/src/content/docs/ missing"] };
  }

  const vaultSlugs = hasVault ? walkMd(vaultRoot) : [];
  const mdxSlugs = walkMdx(mdxRoot);
  const { onlyA: vaultOnly, onlyB: mdxOnly } = diff(vaultSlugs, mdxSlugs);

  const errors = [];
  if (vaultOnly.length) {
    errors.push(
      `vault notes without MDX (${vaultOnly.length}): ${vaultOnly.slice(0, 8).join(", ")}${vaultOnly.length > 8 ? "…" : ""}`,
    );
  }

  return {
    ok: errors.length === 0,
    vaultCount: vaultSlugs.length,
    mdxCount: mdxSlugs.length,
    mdxOnlyCount: mdxOnly.length,
    mdxOnly,
    errors,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const result = checkPublishParity();
  if (!result.ok) {
    for (const e of result.errors) console.error(e);
    console.error(`vault=${result.vaultCount} mdx=${result.mdxCount}`);
    process.exit(1);
  }
  const suffix = result.mdxOnlyCount ? ` (${result.mdxOnlyCount} MDX-only)` : "";
  console.log(
    `publish parity OK: ${result.vaultCount} legacy vault notes covered by ${result.mdxCount} MDX pages${suffix}`,
  );
}
