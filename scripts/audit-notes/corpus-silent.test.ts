import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findShowDontTellCandidates } from "./candidates/show-dont-tell.js";
import { runDeterministic } from "./deterministic.js";

const AUDIT_DIR: string = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT: string = resolve(AUDIT_DIR, "../..");
const MDX_ROOT: string = resolve(REPO_ROOT, "sites/docs/src/content/docs");
const hasMdx: boolean = existsSync(MDX_ROOT);

interface ExpectSilentSpec {
  path: string;
  rule: string;
  line: number;
  reason: string;
}

function loadManifest(): { expectSilent: ExpectSilentSpec[] } {
  const raw: string = readFileSync(
    join(AUDIT_DIR, "fixtures/corpus-manifest.json"),
    "utf8",
  );
  return JSON.parse(raw) as { expectSilent: ExpectSilentSpec[] };
}

/** Lines where the candidate finder still flags by design (not skip-zone). */
const SDT_KNOWN_GAPS: ReadonlySet<string> = new Set([
  "sites/docs/src/content/docs/nestjs/recipes/serialization.mdx:156",
]);

function candidateKey(path: string, line: number): string {
  return `${path}:${line}`;
}

describe("corpus expectSilent (deterministic)", (): void => {
  // Only load manifest if hasVault is true to avoid crashes when content/ is missing
  const manifest = hasMdx ? loadManifest() : { expectSilent: [] };

  it("show-dont-tell candidate finder is silent at manifest lines", { skip: !hasMdx }, (): void => {
    for (const spec of manifest.expectSilent) {
      if (spec.rule !== "show-dont-tell") continue;
      if (SDT_KNOWN_GAPS.has(candidateKey(spec.path, spec.line))) continue;
      const lines: number[] = findShowDontTellCandidates(
        REPO_ROOT,
        spec.path,
      ).map((c) => c.line);
      assert.ok(
        !lines.includes(spec.line),
        `unexpected show-dont-tell candidate at ${spec.path}:${spec.line} (${spec.reason})`,
      );
    }
  });

  it("pass-0 deterministic is silent at manifest lines for style rules", { skip: !hasMdx }, (): void => {
    for (const spec of manifest.expectSilent) {
      if (!spec.rule.startsWith("style-")) continue;
      const abs: string = resolve(REPO_ROOT, spec.path);
      const report = runDeterministic(abs, spec.path);
      const hit = report.findings.some((f) => f.line === spec.line);
      assert.ok(
        !hit,
        `unexpected pass-0 finding at ${spec.path}:${spec.line} [${spec.rule}]`,
      );
    }
  });
});
