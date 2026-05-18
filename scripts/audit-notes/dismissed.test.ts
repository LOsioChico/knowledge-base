import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import {
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  signFinding,
  signLineText,
  filterDismissed,
  loadDismissed,
} from "./dismissed.js";
import type { FlatFinding, RuleId } from "./types.js";

const AUDIT_DIR: string = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT: string = resolve(AUDIT_DIR, "../..");

interface CorpusManifest {
  paths: string[];
  expectSilent: Array<{
    path: string;
    rule: RuleId;
    line: number;
    reason: string;
  }>;
  dismissedShouldSuppress: Array<{
    path: string;
    rule: RuleId;
    sig: string;
  }>;
}

interface DismissedFile {
  entries: Array<{
    path: string;
    sig: string;
    rule: RuleId | "*";
    originalLine: string;
  }>;
}

function findExactLine(path: string, originalLine: string): number | null {
  const abs: string = resolve(REPO_ROOT, path);
  if (!existsSync(abs)) return null;
  const lines: string[] = readFileSync(abs, "utf8").split("\n");
  const trimmed: string = originalLine.trim();
  for (let i: number = 0; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() === trimmed) return i + 1;
  }
  return null;
}

function loadManifest(): CorpusManifest {
  const raw: string = readFileSync(
    join(AUDIT_DIR, "fixtures/corpus-manifest.json"),
    "utf8",
  );
  return JSON.parse(raw) as CorpusManifest;
}

describe("dismissed registry contract", (): void => {
  const registry: DismissedFile = JSON.parse(
    readFileSync(join(AUDIT_DIR, "dismissed.json"), "utf8"),
  ) as DismissedFile;

  it("recomputes signLineText for every stored entry from originalLine", (): void => {
    for (const entry of registry.entries) {
      const recomputed: string = signLineText(
        entry.path,
        entry.rule as RuleId,
        entry.originalLine,
      );
      assert.equal(
        recomputed,
        entry.sig,
        `sig drift for ${entry.path} (${entry.rule})`,
      );
    }
  });

  it("signFinding matches stored sig when originalLine still exists in the file", (): void => {
    const drift: string[] = [];
    for (const entry of registry.entries) {
      const abs: string = resolve(REPO_ROOT, entry.path);
      if (!existsSync(abs)) continue;
      const line: number | null = findExactLine(entry.path, entry.originalLine);
      if (line === null) {
        drift.push(entry.path);
        continue;
      }
      const live: string | null = signFinding(
        REPO_ROOT,
        entry.path,
        entry.rule as RuleId,
        line,
      );
      assert.equal(
        live,
        entry.sig,
        `live-file sig mismatch for ${entry.path}:${line}`,
      );
    }
    assert.ok(
      drift.length <= 15,
      `expected at most 15 prose-drift orphans, got ${drift.length}: ${drift.slice(0, 5).join(", ")}`,
    );
  });

  it("filterDismissed suppresses manifest dismissedShouldSuppress entries", (): void => {
    const manifest: CorpusManifest = loadManifest();
    const entries = loadDismissed();
    const bySig = new Map(entries.map((e) => [e.sig, e]));

    const findings: Array<FlatFinding & { tier: "advisory" }> = [];
    for (const spec of manifest.dismissedShouldSuppress) {
      const entry = bySig.get(spec.sig);
      assert.ok(entry, `missing dismissed entry for sig ${spec.sig}`);
      assert.equal(entry.path, spec.path);
      assert.equal(entry.rule, spec.rule);
      const line: number | null = findExactLine(entry.path, entry.originalLine);
      assert.ok(line !== null, `line not found for ${entry.path}`);
      findings.push({
        path: entry.path,
        rule: entry.rule as RuleId,
        line,
        message: "synthetic finding for suppression test",
        tier: "advisory",
      });
    }

    const { kept, dropped } = filterDismissed(REPO_ROOT, findings);
    assert.equal(kept.length, 0);
    assert.equal(dropped.length, findings.length);
  });
});

describe("signFinding prose drift", (): void => {
  let workdir: string;

  before((): void => {
    workdir = mkdtempSync(join(tmpdir(), "audit-dismissed-"));
  });

  after((): void => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it("changes the signature when trimmed prose on that line changes", (): void => {
    const relPath: string = "content/fixture/drift.md";
    const absDir: string = join(workdir, "content/fixture");
    const absFile: string = join(absDir, "drift.md");
    mkdirSync(absDir, { recursive: true });
    writeFileSync(
      absFile,
      ["---", "title: Drift", "tags: []", "area: test", "status: seed", "related: []", "---", "", "Original claim text.", ""].join(
        "\n",
      ),
      "utf8",
    );

    const rule: RuleId = "style-hedge";
    const claimLine: number = 9;
    const sigBefore: string | null = signFinding(
      workdir,
      relPath,
      rule,
      claimLine,
    );
    assert.ok(sigBefore);

    const lines: string[] = readFileSync(absFile, "utf8").split("\n");
    lines[claimLine - 1] = "Rewritten claim text.";
    writeFileSync(absFile, lines.join("\n"), "utf8");

    const sigAfter: string | null = signFinding(
      workdir,
      relPath,
      rule,
      claimLine,
    );
    assert.ok(sigAfter);
    assert.notEqual(sigBefore, sigAfter);
  });
});
