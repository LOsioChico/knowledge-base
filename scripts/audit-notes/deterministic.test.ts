import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runDeterministic,
  runDeterministicAdvisory,
} from "./deterministic.js";
import type { Finding } from "./types.js";

const VALID_FRONTMATTER: string = [
  "---",
  "title: Example",
  "tags: [type/concept]",
  "area: example",
  "status: evergreen",
  "related: []",
  "---",
  "",
].join("\n");

let workdir: string;
function writeNote(name: string, content: string): string {
  const p: string = join(workdir, name);
  writeFileSync(p, content, "utf8");
  return p;
}
function rules(findings: Finding[]): string[] {
  return findings.map((f: Finding): string => f.rule);
}

before((): void => {
  workdir = mkdtempSync(join(tmpdir(), "audit-det-"));
});
after((): void => {
  rmSync(workdir, { recursive: true, force: true });
});

describe("runDeterministic - frontmatter", (): void => {
  it("flags missing frontmatter block", (): void => {
    const p: string = writeNote("a.md", "no frontmatter here\n");
    const r = runDeterministic(p, "a.md");
    assert.ok(rules(r.findings).includes("frontmatter-schema"));
  });

  it("flags an unclosed frontmatter block", (): void => {
    const p: string = writeNote("b.md", "---\ntitle: x\n\nbody\n");
    const r = runDeterministic(p, "b.md");
    assert.ok(rules(r.findings).includes("frontmatter-schema"));
  });

  it("flags missing required fields", (): void => {
    const p: string = writeNote(
      "c.md",
      ["---", "title: x", "---", "", "> tag", ""].join("\n"),
    );
    const r = runDeterministic(p, "c.md");
    const schemaCount: number = r.findings.filter(
      (f: Finding): boolean => f.rule === "frontmatter-schema",
    ).length;
    // tags, area, status, related all missing -> at least 4 findings.
    assert.ok(schemaCount >= 4);
  });

  it("flags `area/*` in inline tag array", (): void => {
    const note: string = [
      "---",
      "title: x",
      "tags: [type/concept, area/nestjs]",
      "area: nestjs",
      "status: evergreen",
      "related: []",
      "---",
      "",
      "> tag",
      "",
    ].join("\n");
    const p: string = writeNote("d.md", note);
    const r = runDeterministic(p, "d.md");
    assert.ok(
      r.findings.some(
        (f: Finding): boolean =>
          f.rule === "frontmatter-schema" && /area\//.test(f.message),
      ),
    );
  });

  it("flags `area/*` in block-list tag form", (): void => {
    const note: string = [
      "---",
      "title: x",
      "tags:",
      "  - type/concept",
      "  - area/nestjs",
      "area: nestjs",
      "status: evergreen",
      "related: []",
      "---",
      "",
      "> tag",
      "",
    ].join("\n");
    const p: string = writeNote("e.md", note);
    const r = runDeterministic(p, "e.md");
    assert.ok(
      r.findings.some(
        (f: Finding): boolean =>
          f.rule === "frontmatter-schema" && /area\//.test(f.message),
      ),
    );
  });

  it("passes a well-formed frontmatter block", (): void => {
    const p: string = writeNote("f.md", VALID_FRONTMATTER + "> tag\n\nbody\n");
    const r = runDeterministic(p, "f.md");
    assert.equal(
      r.findings.filter(
        (f: Finding): boolean => f.rule === "frontmatter-schema",
      ).length,
      0,
    );
  });
});

describe("runDeterministic - prose style", (): void => {
  it("flags em-dash in body prose", (): void => {
    const p: string = writeNote(
      "g.md",
      VALID_FRONTMATTER + "> tag\n\nthis \u2014 that\n",
    );
    const r = runDeterministic(p, "g.md");
    assert.ok(rules(r.findings).includes("style-em-dash"));
  });

  it("ignores em-dash inside fenced code blocks", (): void => {
    const p: string = writeNote(
      "h.md",
      VALID_FRONTMATTER +
        "> tag\n\n```ts\nconst x = \"a \u2014 b\";\n```\n",
    );
    const r = runDeterministic(p, "h.md");
    assert.ok(!rules(r.findings).includes("style-em-dash"));
  });

  it("ignores em-dash inside inline code spans", (): void => {
    const p: string = writeNote(
      "i.md",
      VALID_FRONTMATTER + "> tag\n\nprose `a \u2014 b` more\n",
    );
    const r = runDeterministic(p, "i.md");
    assert.ok(!rules(r.findings).includes("style-em-dash"));
  });

  it("flags `--` in body prose", (): void => {
    const p: string = writeNote(
      "j.md",
      VALID_FRONTMATTER + "> tag\n\nx -- y\n",
    );
    const r = runDeterministic(p, "j.md");
    assert.ok(rules(r.findings).includes("style-double-hyphen"));
  });

  it("ignores `--` inside code fences", (): void => {
    const p: string = writeNote(
      "k.md",
      VALID_FRONTMATTER + "> tag\n\n```sh\nnpm run lint -- --fix\n```\n",
    );
    const r = runDeterministic(p, "k.md");
    assert.ok(!rules(r.findings).includes("style-double-hyphen"));
  });

  it("does not consider em-dashes inside frontmatter", (): void => {
    const note: string = [
      "---",
      "title: x \u2014 y",
      "tags: [type/concept]",
      "area: x",
      "status: evergreen",
      "related: []",
      "---",
      "",
      "> tag",
      "",
      "body line\n",
    ].join("\n");
    const p: string = writeNote("l.md", note);
    const r = runDeterministic(p, "l.md");
    assert.ok(!rules(r.findings).includes("style-em-dash"));
  });
});

describe("runDeterministicAdvisory - hedges", (): void => {
  it("flags `may apply`", (): void => {
    const p: string = writeNote(
      "m.md",
      VALID_FRONTMATTER + "> tag\n\nthis rule may apply broadly\n",
    );
    const r = runDeterministicAdvisory(p, "m.md");
    assert.ok(r.findings.length > 0);
  });

  it("flags `tends to`", (): void => {
    const p: string = writeNote(
      "n.md",
      VALID_FRONTMATTER + "> tag\n\nthe runtime tends to coerce values\n",
    );
    const r = runDeterministicAdvisory(p, "n.md");
    assert.ok(r.findings.length > 0);
  });

  it("ignores hedge phrases inside inline code", (): void => {
    const p: string = writeNote(
      "o.md",
      VALID_FRONTMATTER + "> tag\n\nthe `tends to` operator is fine\n",
    );
    const r = runDeterministicAdvisory(p, "o.md");
    assert.equal(r.findings.length, 0);
  });

  it("returns no findings for clean prose", (): void => {
    const p: string = writeNote(
      "p.md",
      VALID_FRONTMATTER + "> tag\n\nThis call returns 400 on missing field.\n",
    );
    const r = runDeterministicAdvisory(p, "p.md");
    assert.equal(r.findings.length, 0);
  });
});
