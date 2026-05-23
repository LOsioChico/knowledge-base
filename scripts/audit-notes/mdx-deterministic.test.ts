import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runMdxDeterministic } from "./mdx-deterministic.js";
import type { Finding } from "./types.js";

const VALID_MDX: string = [
  "---",
  "title: Example",
  "description: One-line summary for SEO.",
  "---",
  "",
  "import { Aside } from \"@astrojs/starlight/components\";",
  "",
  "> Tagline for the page. Prerequisite: [[some/prereq|Prereq]].",
  "",
  "## Section",
  "",
].join("\n");

let workdir: string;
function writeMdx(name: string, content: string): string {
  const p = join(workdir, name);
  writeFileSync(p, content, "utf8");
  return p;
}
function rules(findings: Finding[]): string[] {
  return findings.map((f) => f.rule);
}

before(() => {
  workdir = mkdtempSync(join(tmpdir(), "audit-mdx-det-"));
});
after(() => {
  rmSync(workdir, { recursive: true, force: true });
});

describe("runMdxDeterministic", () => {
  it("accepts valid MDX with tagline", () => {
    const p = writeMdx("ok.mdx", VALID_MDX);
    const r = runMdxDeterministic(p, "ok.mdx");
    assert.equal(r.findings.length, 0);
  });

  it("flags missing description", () => {
    const p = writeMdx(
      "bad.mdx",
      ["---", "title: x", "---", "", "> tag", ""].join("\n"),
    );
    const r = runMdxDeterministic(p, "bad.mdx");
    assert.ok(rules(r.findings).includes("frontmatter-schema"));
  });

  it("flags Obsidian callouts", () => {
    const p = writeMdx(
      "callout.mdx",
      `${VALID_MDX}> [!warning] footgun\n`,
    );
    const r = runMdxDeterministic(p, "callout.mdx");
    assert.ok(rules(r.findings).includes("callout-placement"));
  });

  it("flags Aside type=warning", () => {
    const p = writeMdx(
      "aside.mdx",
      `${VALID_MDX}<Aside type="warning">bad</Aside>\n`,
    );
    const r = runMdxDeterministic(p, "aside.mdx");
    assert.ok(
      r.findings.some((f) => f.message.includes('type="warning"')),
    );
  });

  it("flags em-dash in prose", () => {
    const p = writeMdx(
      "dash.mdx",
      `${VALID_MDX}Prose with an em\u2014dash here.\n`,
    );
    const r = runMdxDeterministic(p, "dash.mdx");
    assert.ok(rules(r.findings).includes("style-em-dash"));
  });

  it("flags unclosed frontmatter block", () => {
    const p = writeMdx(
      "unclosed.mdx",
      ["---", "title: x", "description: y", "", "> tag"].join("\n"),
    );
    const r = runMdxDeterministic(p, "unclosed.mdx");
    assert.ok(rules(r.findings).includes("frontmatter-schema"));
    assert.ok(r.findings.some((f) => f.message.includes("not closed")));
  });

  it("flags missing body tagline blockquote", () => {
    const p = writeMdx(
      "notagline.mdx",
      [
        "---",
        "title: Example",
        "description: One-line summary for SEO.",
        "---",
        "",
        "## Section without tagline first",
      ].join("\n"),
    );
    const r = runMdxDeterministic(p, "notagline.mdx");
    assert.ok(rules(r.findings).includes("frontmatter-schema"));
    assert.ok(r.findings.some((f) => f.message.includes("tagline blockquote")));
  });

  it("flags unknown Aside type", () => {
    const p = writeMdx(
      "unknown-aside.mdx",
      `${VALID_MDX}<Aside type="info">this is unknown</Aside>\n`,
    );
    const r = runMdxDeterministic(p, "unknown-aside.mdx");
    assert.ok(rules(r.findings).includes("frontmatter-schema"));
    assert.ok(r.findings.some((f) => f.message.includes('Unknown Aside type "info"')));
  });

  it("flags legacy vault path wikilinks", () => {
    const p = writeMdx(
      "legacy-link.mdx",
      `${VALID_MDX}Check this [[content/aws/s3.md|S3 note]].\n`,
    );
    const r = runMdxDeterministic(p, "legacy-link.mdx");
    assert.ok(rules(r.findings).includes("frontmatter-schema"));
    assert.ok(r.findings.some((f) => f.message.includes("targets vault path")));
  });

  it("flags missing prerequisite badge or tagline prerequisite", () => {
    const p = writeMdx(
      "noprereqs.mdx",
      [
        "---",
        "title: Example",
        "description: One-line summary for SEO.",
        "---",
        "",
        "> Tagline without prerequisite indicator.",
        "",
        "## Section",
      ].join("\n"),
    );
    const r = runMdxDeterministic(p, "noprereqs.mdx");
    assert.ok(rules(r.findings).includes("frontmatter-schema"));
    assert.ok(r.findings.some((f) => f.message.includes("prerequisite documentation")));
  });

  it("skips prerequisite check on index notes", () => {
    const p = writeMdx(
      "index.mdx",
      [
        "---",
        "title: Index MOC",
        "description: Map of Content.",
        "---",
        "",
        "> MOC Tagline.",
        "",
        "## Content",
      ].join("\n"),
    );
    const r = runMdxDeterministic(p, "index.mdx");
    assert.equal(r.findings.length, 0);
  });
});
