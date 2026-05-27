#!/usr/bin/env node
/**
 * lint-interactive-components.mjs — CodeWalkthrough line-range validator
 *
 * For every <CodeWalkthrough> in the MDX docs, this script:
 *   1. Extracts the wrapped code block (the ``` ... ``` between the tag and </CodeWalkthrough>)
 *   2. Parses each step's `lines` prop
 *   3. Flags ranges that are out-of-bounds or start/end on blank lines
 *
 * Design: only flag things that are ALWAYS wrong. No heuristic checks that
 * could produce false positives (e.g., no "is this JSDoc?" guessing).
 *
 * What this does NOT catch (requires human review on dev server):
 *   - Semantic off-by-one where both the wrong and right line have valid code
 *   - Step body/note text that references the wrong composition style
 *   - Placement of interactive components in the wrong section
 *
 * Run:  node scripts/lint-interactive-components.mjs
 * CI:   wired into `lint:ci:tooling`
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const docsRoot = join(repoRoot, "sites/docs/src/content/docs");

async function walkMdx(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkMdx(path)));
    else if (entry.name.endsWith(".mdx")) files.push(path);
  }
  return files;
}

/**
 * Find the code block between <CodeWalkthrough and </CodeWalkthrough>.
 * Returns the lines of the code block (without the fence lines), or null.
 */
function extractCodeBlock(mdxLines, cwStartIdx) {
  let fenceStart = -1;
  let fenceEnd = -1;

  for (let i = cwStartIdx + 1; i < mdxLines.length; i++) {
    const line = mdxLines[i];
    // Stop searching at the closing tag
    if (/<\/CodeWalkthrough>/.test(line)) break;

    if (fenceStart === -1 && /^\s*```\w/.test(line)) {
      fenceStart = i;
    } else if (fenceStart !== -1 && /^\s*```\s*$/.test(line)) {
      fenceEnd = i;
      break;
    }
  }

  if (fenceStart === -1 || fenceEnd === -1) return null;

  const codeLines = [];
  for (let i = fenceStart + 1; i < fenceEnd; i++) {
    codeLines.push(mdxLines[i]);
  }
  return codeLines;
}

/**
 * Extract step line ranges from between <CodeWalkthrough and the first code fence.
 * Only parses `lines: "X-Y"` patterns — this prop only appears in step definitions.
 */
function parseLineRanges(mdxLines, cwStartIdx) {
  let propsText = "";
  for (let i = cwStartIdx; i < mdxLines.length; i++) {
    // Stop at the first code fence — everything before it is props
    if (/^\s*```\w/.test(mdxLines[i])) break;
    // Also stop at closing tag
    if (/<\/CodeWalkthrough>/.test(mdxLines[i])) break;
    propsText += mdxLines[i] + "\n";
  }

  const re = /lines:\s*"(\d+(?:-\d+)?)"/g;
  const ranges = [];
  for (const match of propsText.matchAll(re)) {
    const raw = match[1];
    const parts = raw.split("-").map(Number);
    ranges.push({
      raw,
      start: parts[0],
      end: parts.length > 1 ? parts[1] : parts[0],
    });
  }
  return ranges;
}

// ────────────────────────────────────────────────

const files = await walkMdx(docsRoot);
/** @type {{ file: string; line: number; msg: string }[]} */
const errors = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  const rel = relative(repoRoot, file).replace(/\\/g, "/");
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (!/<CodeWalkthrough/.test(lines[i])) continue;

    const codeLines = extractCodeBlock(lines, i);
    if (!codeLines || codeLines.length === 0) continue;

    const ranges = parseLineRanges(lines, i);
    const totalLines = codeLines.length;

    for (let stepIdx = 0; stepIdx < ranges.length; stepIdx++) {
      const r = ranges[stepIdx];
      const label = `Step ${stepIdx + 1} (lines "${r.raw}")`;

      // 1. Bounds check
      if (r.start < 1 || r.end > totalLines) {
        errors.push({
          file: rel,
          line: i + 1,
          msg: `${label}: out of bounds — code block has ${totalLines} lines`,
        });
        continue;
      }

      // 2. Start > end
      if (r.start > r.end) {
        errors.push({
          file: rel,
          line: i + 1,
          msg: `${label}: start (${r.start}) > end (${r.end})`,
        });
        continue;
      }

      // 3. First line must not be blank
      if (codeLines[r.start - 1].trim() === "") {
        errors.push({
          file: rel,
          line: i + 1,
          msg: `${label}: starts on a blank line — shift start forward`,
        });
      }

      // 4. Last line must not be blank
      if (codeLines[r.end - 1].trim() === "") {
        errors.push({
          file: rel,
          line: i + 1,
          msg: `${label}: ends on a blank line — shift end backward`,
        });
      }
    }
  }
}

// ────────────────────────────────────────────────

if (errors.length) {
  console.error(
    `✗ interactive-components: ${errors.length} issue(s) in CodeWalkthrough line ranges\n`,
  );
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line}`);
    console.error(`    ${e.msg}\n`);
  }
  process.exit(1);
}

console.log(
  `✓ interactive-components: ${files.length} file(s) checked, all CodeWalkthrough line ranges valid`,
);
