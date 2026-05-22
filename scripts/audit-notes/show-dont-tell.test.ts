import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { findShowDontTellCandidates } from "./candidates/show-dont-tell.js";

const REPO_ROOT: string = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const hasVault: boolean = existsSync(resolve(REPO_ROOT, "content"));

function candidateLines(repoRelPath: string): number[] {
  return findShowDontTellCandidates(REPO_ROOT, repoRelPath).map(
    (c) => c.line,
  );
}

describe("findShowDontTellCandidates", { skip: !hasVault }, (): void => {
  it("does not flag the frontmatter opening fence (line 1)", (): void => {
    const path: string = "content/nestjs/recipes/serialization.md";
    const lines: number[] = candidateLines(path);
    assert.ok(!lines.includes(1), `unexpected candidate at line 1: ${lines}`);
  });

  it("does not flag the recipe tagline blockquote (line 29)", (): void => {
    const path: string = "content/nestjs/recipes/serialization.md";
    const lines: number[] = candidateLines(path);
    assert.ok(!lines.includes(29), `tagline should be skipped: ${lines}`);
  });

  it("skips behavioral claims inside Obsidian callouts", (): void => {
    const path: string = "content/nestjs/fundamentals/exception-filters.md";
    const lines: number[] = candidateLines(path);
    for (const line of [202, 203, 207]) {
      assert.ok(
        !lines.includes(line),
        `callout interior line ${line} should be skipped`,
      );
    }
  });

  it("flags serialization L156 when req/res example is only above (backward-window gap)", (): void => {
    const path: string = "content/nestjs/recipes/serialization.md";
    const lines: number[] = candidateLines(path);
    assert.ok(
      lines.includes(156),
      "known gap: forward-only window misses example above the claim",
    );
  });
});
