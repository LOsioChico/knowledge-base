import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const mergeScript = join(repoRoot, "scripts/merge-pages.mjs");

test("merge-pages: Starlight wins on path conflicts", () => {
  const root = mkdtempSync(join(tmpdir(), "merge-pages-"));
  const quartz = join(root, "quartz");
  const starlight = join(root, "starlight");
  const out = join(root, "out");

  try {
    mkdirSync(quartz, { recursive: true });
    mkdirSync(starlight, { recursive: true });
    writeFileSync(join(quartz, "effect-ts.html"), "<html>quartz</html>");
    writeFileSync(join(quartz, "nestjs.html"), "<html>nestjs</html>");
    writeFileSync(join(starlight, "effect-ts.html"), "<html>starlight</html>");

    const result = spawnSync(
      process.execPath,
      [mergeScript, quartz, starlight, out],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);

    assert.equal(readFileSync(join(out, "effect-ts.html"), "utf8"), "<html>starlight</html>");
    assert.equal(readFileSync(join(out, "nestjs.html"), "utf8"), "<html>nestjs</html>");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("merge-pages: exits non-zero when inputs missing", () => {
  const root = mkdtempSync(join(tmpdir(), "merge-pages-"));
  const missing = join(root, "nope");
  const starlight = join(root, "starlight");
  const out = join(root, "out");
  try {
    mkdirSync(starlight, { recursive: true });
    writeFileSync(join(starlight, "index.html"), "ok");
    const result = spawnSync(
      process.execPath,
      [mergeScript, missing, starlight, out],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.ok(!existsSync(out));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
