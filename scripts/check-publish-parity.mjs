#!/usr/bin/env node
/**
 * MDX page-count health check.
 *
 * Previously this script compared legacy vault notes (content/) against MDX
 * pages (sites/docs/src/content/docs/). The vault has been fully migrated and
 * removed, so this now simply counts published MDX pages as a build health
 * check. The function signature is preserved for backward compatibility with
 * vault-check-lib.mjs.
 */

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

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

export function checkPublishParity(repoRoot = REPO_ROOT) {
  const mdxRoot = join(repoRoot, "sites/docs/src/content/docs");

  if (!existsSync(mdxRoot)) {
    return { ok: false, errors: ["sites/docs/src/content/docs/ missing"] };
  }

  const mdxSlugs = walkMdx(mdxRoot);

  return {
    ok: true,
    vaultCount: 0,
    mdxCount: mdxSlugs.length,
    mdxOnlyCount: mdxSlugs.length,
    mdxOnly: mdxSlugs,
    errors: [],
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const result = checkPublishParity();
  if (!result.ok) {
    for (const e of result.errors) console.error(e);
    process.exit(1);
  }
  console.log(
    `publish parity OK: ${result.mdxCount} MDX pages published`,
  );
}
