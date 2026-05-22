import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  findSkipLines,
  isLineInSkipZone,
  readNoteText,
} from "./skip-zones.js";

const AUDIT_DIR: string = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT: string = resolve(AUDIT_DIR, "../..");

const hasVault: boolean = existsSync(resolve(REPO_ROOT, "content"));

function loadManifest(): {
  expectSilent: Array<{ path: string; rule: string; line: number }>;
} {
  const raw: string = readFileSync(
    join(AUDIT_DIR, "fixtures/corpus-manifest.json"),
    "utf8",
  );
  return JSON.parse(raw) as {
    expectSilent: Array<{ path: string; rule: string; line: number }>;
  };
}

describe("skip-zones", (): void => {
  it("skips ## Pending section bodies", { skip: !hasVault }, (): void => {
    const path: string = "content/nestjs/fundamentals/index.md";
    const text: string = readNoteText(REPO_ROOT, path);
    assert.ok(isLineInSkipZone(text, 29));
    assert.ok(!isLineInSkipZone(text, 17));
  });

  it("skips What's NOT playbook exclusion sections", { skip: !hasVault }, (): void => {
    const path: string = "content/aws/account-migrations.md";
    const text: string = readNoteText(REPO_ROOT, path);
    assert.ok(isLineInSkipZone(text, 81));
    assert.ok(!isLineInSkipZone(text, 75));
  });

  it("covers style-jargon expectSilent lines from corpus manifest", { skip: !hasVault }, (): void => {
    const manifest = loadManifest();
    for (const spec of manifest.expectSilent) {
      if (spec.rule !== "style-jargon") continue;
      const text: string = readNoteText(REPO_ROOT, spec.path);
      assert.ok(
        isLineInSkipZone(text, spec.line),
        `expected skip zone at ${spec.path}:${spec.line}`,
      );
    }
  });

  it("findSkipLines includes (planned) wikilink lines", (): void => {
    const sample: string = [
      "---",
      "title: T",
      "tags: []",
      "area: test",
      "status: seed",
      "related: []",
      "---",
      "",
      "Body line.",
      "- [[foo/bar|Widget (planned)]]",
      "",
    ].join("\n");
    const skip: Set<number> = findSkipLines(sample);
    assert.ok(skip.has(10));
    assert.ok(!skip.has(9));
  });
});
