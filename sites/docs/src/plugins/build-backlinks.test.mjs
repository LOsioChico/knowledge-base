import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildBacklinkIndex,
  extractOutboundSlugs,
  filePathToSlug,
} from "./build-backlinks.mjs";
import { collectDocSlugs } from "./doc-slugs.mjs";
import { remarkBacklinks } from "./remark-backlinks.mjs";

describe("build-backlinks", () => {
  it("indexes wikilink and internal markdown links", () => {
    const root = mkdtempSync(join(tmpdir(), "backlinks-"));
    const area = join(root, "area");
    mkdirSync(area, { recursive: true });
    writeFileSync(
      join(area, "source.mdx"),
      [
        "---",
        "title: Source",
        "description: d",
        "---",
        "",
        "> t",
        "",
        "See [[area/target|Target]].",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(area, "target.mdx"),
      ["---", "title: Target", "description: d", "---", "", "> t", ""].join(
        "\n",
      ),
    );

    const slugs = collectDocSlugs(root);
    const out = extractOutboundSlugs(
      "link [[area/target]] and [x](/knowledge-base/area/target/)",
      slugs,
      "/knowledge-base",
    );
    assert.ok(out.has("area/target"));

    const index = buildBacklinkIndex(root, "/knowledge-base");
    assert.deepEqual(index["area/target"], ["area/source"]);

    rmSync(root, { recursive: true, force: true });
  });

  it("remarkBacklinks tolerates missing vfile (MDX rollup build)", () => {
    const root = mkdtempSync(join(tmpdir(), "backlinks-undef-"));
    const area = join(root, "area");
    mkdirSync(area, { recursive: true });
    writeFileSync(
      join(area, "target.mdx"),
      ["---", "title: Target", "description: d", "---", "", "> t", ""].join(
        "\n",
      ),
    );
    const tree = { type: "root", children: [] };
    const plugin = remarkBacklinks({ docsRoot: root, base: "/kb" });
    assert.doesNotThrow(() => plugin(tree, undefined));
    rmSync(root, { recursive: true, force: true });
  });

  it("maps index.mdx to parent slug", () => {
    const root = mkdtempSync(join(tmpdir(), "backlinks-idx-"));
    const area = join(root, "area");
    mkdirSync(area, { recursive: true });
    const indexPath = join(area, "index.mdx");
    writeFileSync(
      indexPath,
      ["---", "title: Area", "description: d", "---", "", "> t", ""].join(
        "\n",
      ),
    );
    assert.equal(filePathToSlug(root, indexPath), "area");
    rmSync(root, { recursive: true, force: true });
  });
});
