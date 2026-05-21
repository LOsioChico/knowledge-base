import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = "scripts/algomaster-intake.mjs";

test("algomaster intake extracts React Flight lesson text from local exports", async () => {
  const dir = await mkdtemp(join(tmpdir(), "algomaster-intake-"));
  try {
    const input = join(dir, "lesson.html");
    const output = join(dir, "inventory.md");
    await writeFile(
      input,
      `<!doctype html><html><head><title>Course Introduction | System Design</title></head><body>
<script>self.__next_f.push([1,"Welcome to a course on System Design Fundamentals. This course explains core distributed systems concepts in one structured place."])</script>
</body></html>`,
      "utf8",
    );

    const result = spawnSync(process.execPath, [script, "--input", input, "--out", output], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    const inventory = await readFile(output, "utf8");
    assert.match(inventory, /^# Course Introduction/m);
    assert.doesNotMatch(inventory, /Candidate claims to verify/);
    assert.match(
      inventory,
      /This course explains core distributed systems concepts in one structured place\./,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("algomaster intake refuses to send credentials to non-AlgoMaster URLs", () => {
  const result = spawnSync(process.execPath, [script, "--url", "https://example.com/lesson"], {
    encoding: "utf8",
    env: {
      ...process.env,
      ALGOMASTER_COOKIE: "placeholder=session",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing to send AlgoMaster credentials to non-AlgoMaster URL/);
});

test("algomaster intake refuses to send credentials over HTTP", () => {
  const result = spawnSync(process.execPath, [script, "--url", "http://algomaster.io/lesson"], {
    encoding: "utf8",
    env: {
      ...process.env,
      ALGOMASTER_AUTHORIZATION: "Bearer placeholder",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refusing to send AlgoMaster credentials to non-HTTPS URL/);
});
