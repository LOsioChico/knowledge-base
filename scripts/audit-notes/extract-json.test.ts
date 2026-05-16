import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { extractJson } from "./extract-json.js";

describe("extractJson", (): void => {
  it("returns the fenced ```json block when present", (): void => {
    const text: string = [
      "Some narration about findings.",
      "```json",
      '{"findings": []}',
      "```",
    ].join("\n");
    assert.equal(extractJson(text), '{"findings": []}');
  });

  it("prefers the LAST fenced json block (assistant restates schema)", (): void => {
    const text: string = [
      "```json",
      '{"draft": true}',
      "```",
      "After review...",
      "```json",
      '{"final": true}',
      "```",
    ].join("\n");
    assert.equal(extractJson(text), '{"final": true}');
  });

  it("falls back to a balanced top-level object when no fence is present", (): void => {
    const text: string = 'Findings: {"rule":"x","line":1}';
    const out: string = extractJson(text);
    assert.deepEqual(JSON.parse(out), { rule: "x", line: 1 });
  });

  it("ignores `{` characters inside string literals", (): void => {
    const text: string =
      'preface {"snippet":"import { Foo } from \'bar\'","ok":true}';
    const out: string = extractJson(text);
    assert.deepEqual(JSON.parse(out), {
      snippet: "import { Foo } from 'bar'",
      ok: true,
    });
  });

  it("respects escaped quotes when tracking string boundaries", (): void => {
    const text: string = '{"q":"he said \\"hi\\" then {","done":true}';
    const out: string = extractJson(text);
    assert.deepEqual(JSON.parse(out), { q: 'he said "hi" then {', done: true });
  });

  it("returns the outermost balanced object, not a nested fragment", (): void => {
    const text: string = '{"outer":{"inner":1},"k":2}';
    const out: string = extractJson(text);
    assert.deepEqual(JSON.parse(out), { outer: { inner: 1 }, k: 2 });
  });

  it("skips prose that quotes code containing `{` before the real JSON", (): void => {
    const text: string = [
      "Notice the import `import { Foo } from 'bar'` above.",
      "Final result:",
      '{"findings":[{"rule":"r","line":1}]}',
    ].join("\n");
    const out: string = extractJson(text);
    assert.deepEqual(JSON.parse(out), {
      findings: [{ rule: "r", line: 1 }],
    });
  });

  it("falls through to balanced scan when the fenced block is not valid JSON", (): void => {
    const text: string = [
      "```json",
      "this is not json at all",
      "```",
      '{"recovered":true}',
    ].join("\n");
    const out: string = extractJson(text);
    assert.deepEqual(JSON.parse(out), { recovered: true });
  });

  it("throws when no parseable object exists", (): void => {
    assert.throws((): string => extractJson("nothing parseable here"));
  });

  it("throws on a malformed fenced block with no balanced fallback", (): void => {
    const text: string = "```json\n{broken\n```";
    assert.throws((): string => extractJson(text));
  });
});
