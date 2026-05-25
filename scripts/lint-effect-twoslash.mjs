#!/usr/bin/env node
/**
 * lint-effect-twoslash.mjs — Deterministic check: if a ts/typescript code block
 * imports from "effect" or "@effect/*", it MUST have the twoslash annotation.
 *
 * Rationale: Effect-TS code blocks that import from the effect ecosystem should
 * use twoslash for type-checking and type display. Blocks without effect imports
 * (e.g. NestJS comparisons, pseudocode) are exempt.
 *
 * Exit code 0 = clean, 1 = violations found.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DOCS_ROOT = 'sites/docs/src/content/docs';

/** Recursively collect all .mdx files */
async function collectMdx(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await collectMdx(full)));
    else if (e.name.endsWith('.mdx')) files.push(full);
  }
  return files;
}

/**
 * Check if a code block body imports from effect ecosystem.
 * Matches: import { X } from "effect"
 *          import { X } from "@effect/platform"
 *          import * as Effect from "effect"
 */
const EFFECT_IMPORT_RE = /^\s*import\s+.+\s+from\s+["'](?:effect|@effect\/)/m;

const violations = [];
let filesChecked = 0;

const files = await collectMdx(DOCS_ROOT);

for (const fpath of files) {
  const content = await readFile(fpath, 'utf8');
  const lines = content.split('\n');
  filesChecked++;

  let inBlock = false;
  let blockStart = -1;
  let blockLang = '';
  let hasTwoslash = false;
  let blockBody = [];

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trimStart();

    if (!inBlock && /^```(typescript|ts)(\s|$)/.test(stripped)) {
      inBlock = true;
      blockStart = i + 1; // 1-indexed
      blockLang = stripped;
      hasTwoslash = /twoslash/.test(stripped);
      blockBody = [];
    } else if (inBlock && stripped.startsWith('```')) {
      // End of block — check
      const body = blockBody.join('\n');
      if (EFFECT_IMPORT_RE.test(body) && !hasTwoslash) {
        const rel = relative(DOCS_ROOT, fpath);
        violations.push({ file: rel, line: blockStart, lang: blockLang.trim() });
      }
      inBlock = false;
      blockBody = [];
    } else if (inBlock) {
      blockBody.push(lines[i]);
    }
  }
}

if (violations.length > 0) {
  console.error(`✗ effect-twoslash: ${violations.length} block(s) import from effect but lack twoslash:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.lang}`);
  }
  process.exit(1);
} else {
  console.log(`✓ effect-twoslash: ${filesChecked} file(s), all effect-importing blocks have twoslash`);
}
