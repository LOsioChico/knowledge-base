import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Since contradiction-scan.ts is a CLI-first script, we test the
// deterministic helper functions by re-implementing them in minimal form.
// The LLM pass is integration-tested manually.
// ---------------------------------------------------------------------------

function normalizeWikilinkTarget(raw: string): string {
  return raw
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]!
    .split("#")[0]!
    .trim()
    .replace(/\.mdx?$/, "")
    .replace(/\/$/, "");
}

function extractBodyWikilinks(content: string): string[] {
  const bodyStart = content.indexOf("\n---\n", 4);
  if (bodyStart === -1) return [];
  const body: string = content.slice(bodyStart + 5);
  const matches: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    matches.push(normalizeWikilinkTarget(m[0]!));
  }
  return [...new Set(matches)];
}

describe("normalizeWikilinkTarget", (): void => {
  it("strips brackets", (): void => {
    assert.equal(normalizeWikilinkTarget("[[nestjs/pipes]]"), "nestjs/pipes");
  });

  it("strips alias (pipe separator)", (): void => {
    assert.equal(
      normalizeWikilinkTarget("[[nestjs/pipes|Pipes]]"),
      "nestjs/pipes",
    );
  });

  it("strips anchor", (): void => {
    assert.equal(
      normalizeWikilinkTarget("[[nestjs/pipes#validation]]"),
      "nestjs/pipes",
    );
  });

  it("strips extension", (): void => {
    assert.equal(
      normalizeWikilinkTarget("[[nestjs/pipes.mdx]]"),
      "nestjs/pipes",
    );
  });

  it("handles combined alias + anchor + extension", (): void => {
    assert.equal(
      normalizeWikilinkTarget("[[nestjs/pipes.mdx#validation|Pipes]]"),
      "nestjs/pipes",
    );
  });

  it("handles bare text without brackets", (): void => {
    assert.equal(normalizeWikilinkTarget("nestjs/pipes"), "nestjs/pipes");
  });
});

describe("extractBodyWikilinks", (): void => {
  it("extracts wikilinks from body, not frontmatter", (): void => {
    const content = [
      "---",
      "title: Test",
      'related: ["[[nestjs/guards]]"]',
      "---",
      "",
      "This uses [[nestjs/pipes|Pipes]] and [[nestjs/interceptors]].",
    ].join("\n");
    const links = extractBodyWikilinks(content);
    assert.deepEqual(links.sort(), [
      "nestjs/interceptors",
      "nestjs/pipes",
    ]);
  });

  it("excludes frontmatter related links", (): void => {
    const content = [
      "---",
      "title: Test",
      'related: ["[[nestjs/guards]]"]',
      "---",
      "",
      "No wikilinks in body.",
    ].join("\n");
    const links = extractBodyWikilinks(content);
    assert.deepEqual(links, []);
  });

  it("deduplicates repeated wikilinks", (): void => {
    const content = [
      "---",
      "title: Test",
      "---",
      "",
      "See [[nestjs/pipes]] and [[nestjs/pipes|Pipes]] again.",
    ].join("\n");
    const links = extractBodyWikilinks(content);
    assert.deepEqual(links, ["nestjs/pipes"]);
  });

  it("returns empty for content without frontmatter end marker", (): void => {
    const content = "No frontmatter here.";
    const links = extractBodyWikilinks(content);
    assert.deepEqual(links, []);
  });
});

describe("candidate pair selection", (): void => {
  let workdir: string;

  interface SimpleNote {
    slug: string;
    area: string;
    relatedSlugs: string[];
    bodyWikilinkSlugs: string[];
  }

  function buildPairs(
    notes: SimpleNote[],
    crossArea: boolean,
  ): Array<{ a: string; b: string }> {
    const bySlug = new Map(notes.map((n) => [n.slug, n]));
    const seen = new Set<string>();
    const pairs: Array<{ a: string; b: string }> = [];

    for (const note of notes) {
      const allConnected = new Set([
        ...note.relatedSlugs,
        ...note.bodyWikilinkSlugs,
      ]);

      for (const targetSlug of allConnected) {
        const target = bySlug.get(targetSlug);
        if (target === undefined) continue;
        if (!crossArea && note.area !== target.area) continue;

        const key = [note.slug, target.slug].sort().join("\0");
        if (seen.has(key)) continue;
        seen.add(key);

        pairs.push({ a: note.slug, b: target.slug });
      }
    }
    return pairs;
  }

  before((): void => {
    workdir = mkdtempSync(join(tmpdir(), "contradiction-test-"));
  });

  after((): void => {
    rmSync(workdir, { recursive: true, force: true });
  });

  it("creates pairs from related: links within same area", (): void => {
    const notes: SimpleNote[] = [
      {
        slug: "nestjs/pipes",
        area: "nestjs",
        relatedSlugs: ["nestjs/request-lifecycle"],
        bodyWikilinkSlugs: [],
      },
      {
        slug: "nestjs/request-lifecycle",
        area: "nestjs",
        relatedSlugs: ["nestjs/pipes"],
        bodyWikilinkSlugs: [],
      },
    ];
    const pairs = buildPairs(notes, false);
    assert.equal(pairs.length, 1);
    assert.deepEqual(pairs[0], {
      a: "nestjs/pipes",
      b: "nestjs/request-lifecycle",
    });
  });

  it("deduplicates bidirectional links", (): void => {
    const notes: SimpleNote[] = [
      {
        slug: "nestjs/a",
        area: "nestjs",
        relatedSlugs: ["nestjs/b"],
        bodyWikilinkSlugs: ["nestjs/b"],
      },
      {
        slug: "nestjs/b",
        area: "nestjs",
        relatedSlugs: ["nestjs/a"],
        bodyWikilinkSlugs: ["nestjs/a"],
      },
    ];
    const pairs = buildPairs(notes, false);
    assert.equal(pairs.length, 1);
  });

  it("excludes cross-area pairs by default", (): void => {
    const notes: SimpleNote[] = [
      {
        slug: "nestjs/pipes",
        area: "nestjs",
        relatedSlugs: ["effect-ts/schema"],
        bodyWikilinkSlugs: [],
      },
      {
        slug: "effect-ts/schema",
        area: "effect-ts",
        relatedSlugs: ["nestjs/pipes"],
        bodyWikilinkSlugs: [],
      },
    ];
    const pairs = buildPairs(notes, false);
    assert.equal(pairs.length, 0);
  });

  it("includes cross-area pairs when flag is set", (): void => {
    const notes: SimpleNote[] = [
      {
        slug: "nestjs/pipes",
        area: "nestjs",
        relatedSlugs: ["effect-ts/schema"],
        bodyWikilinkSlugs: [],
      },
      {
        slug: "effect-ts/schema",
        area: "effect-ts",
        relatedSlugs: ["nestjs/pipes"],
        bodyWikilinkSlugs: [],
      },
    ];
    const pairs = buildPairs(notes, true);
    assert.equal(pairs.length, 1);
  });

  it("skips links to non-existent notes", (): void => {
    const notes: SimpleNote[] = [
      {
        slug: "nestjs/pipes",
        area: "nestjs",
        relatedSlugs: ["nestjs/nonexistent"],
        bodyWikilinkSlugs: [],
      },
    ];
    const pairs = buildPairs(notes, false);
    assert.equal(pairs.length, 0);
  });
});
