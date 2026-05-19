#!/usr/bin/env node
/**
 * Merge Quartz static output with Starlight dist for GitHub Pages.
 * Starlight wins on path conflicts (migrated areas overlay Quartz).
 *
 * Usage: node scripts/merge-pages.mjs <quartz-public> <starlight-dist> <output-dir>
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const [quartzPublic, starlightDist, outputDir] = process.argv.slice(2);

if (!quartzPublic || !starlightDist || !outputDir) {
  console.error(
    "Usage: node scripts/merge-pages.mjs <quartz-public> <starlight-dist> <output-dir>",
  );
  process.exit(1);
}

const quartz = resolve(quartzPublic);
const starlight = resolve(starlightDist);
const out = resolve(outputDir);

if (!existsSync(quartz)) {
  console.error(`Quartz public dir not found: ${quartz}`);
  process.exit(1);
}
if (!existsSync(starlight)) {
  console.error(`Starlight dist not found: ${starlight}`);
  process.exit(1);
}

if (existsSync(out)) {
  rmSync(out, { recursive: true, force: true });
}
mkdirSync(out, { recursive: true });

cpSync(quartz, out, { recursive: true });
cpSync(starlight, out, { recursive: true });

console.log(`Merged ${quartz} + ${starlight} -> ${out}`);
