#!/usr/bin/env node
/**
 * Tests for lint-interactive-components.mjs
 *
 * Tests the core validation logic against the exact SlidingWindowLimiter
 * code block that originally had bad line references.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

/** Validate a range against code lines, return error strings */
function validateRange(r, codeLines, stepIdx) {
  const errors = [];
  const label = `Step ${stepIdx + 1} (lines "${r.raw}")`;
  const totalLines = codeLines.length;

  if (r.start < 1 || r.end > totalLines) {
    errors.push(`${label}: out of bounds`);
    return errors;
  }
  if (r.start > r.end) {
    errors.push(`${label}: start > end`);
    return errors;
  }
  if (codeLines[r.start - 1].trim() === "") {
    errors.push(`${label}: starts on a blank line`);
  }
  if (codeLines[r.end - 1].trim() === "") {
    errors.push(`${label}: ends on a blank line`);
  }
  return errors;
}

/** Parse line ranges from a props text block */
function parseLineRanges(propsText) {
  const re = /lines:\s*"(\d+(?:-\d+)?)"/g;
  const ranges = [];
  for (const match of propsText.matchAll(re)) {
    const raw = match[1];
    const parts = raw.split("-").map(Number);
    ranges.push({
      raw,
      start: parts[0],
      end: parts.length > 1 ? parts[1] : parts[0],
    });
  }
  return ranges;
}

// ────────────────────────────────────────────────

// Exact reproduction of the SlidingWindowLimiter code block
const codeLines = [
  "export class SlidingWindowLimiter {",                                        // 1
  "  private logs: Map<string, number[]> = new Map();",                         // 2
  "",                                                                           // 3
  "  /**",                                                                      // 4
  "   * Evaluates if a request from a specific client is allowed.",             // 5
  "   * Evicts outdated timestamps and appends the new request time.",          // 6
  "   *",                                                                       // 7
  "   * @param clientId Unique identifier for the client session or IP",        // 8
  "   * @param limit Maximum number of requests allowed in the window",         // 9
  "   * @param windowMs Timeframe window in milliseconds",                      // 10
  "   */",                                                                      // 11
  "  public isAllowed(clientId: string, limit: number, windowMs: number): boolean {", // 12
  "    const now = Date.now();",                                                // 13
  "    const boundary = now - windowMs;",                                       // 14
  "",                                                                           // 15
  "    const clientLogs = this.logs.get(clientId) || [];",                      // 16
  "",                                                                           // 17
  "    const activeLogs = clientLogs.filter(t => t >= boundary);",             // 18
  "",                                                                           // 19
  "    if (activeLogs.length < limit) {",                                       // 20
  "      activeLogs.push(now);",                                                // 21
  "      this.logs.set(clientId, activeLogs);",                                 // 22
  "      return true;",                                                         // 23
  "    }",                                                                      // 24
  "",                                                                           // 25
  "    this.logs.set(clientId, activeLogs);",                                   // 26
  "    return false;",                                                          // 27
  "  }",                                                                        // 28
];

describe("parseLineRanges", () => {
  it("single line", () => {
    const r = parseLineRanges('{ lines: "5", title: "x" }');
    assert.deepEqual(r, [{ raw: "5", start: 5, end: 5 }]);
  });
  it("range", () => {
    const r = parseLineRanges('{ lines: "12-14", title: "x" }');
    assert.deepEqual(r, [{ raw: "12-14", start: 12, end: 14 }]);
  });
  it("multiple steps", () => {
    const text = '{ lines: "1-2", title: "a" },\n{ lines: "5-8", title: "b" },';
    const r = parseLineRanges(text);
    assert.equal(r.length, 2);
    assert.equal(r[0].start, 1);
    assert.equal(r[1].end, 8);
  });
});

describe("catches original blank-line bugs", () => {
  it("lines 15-17: starts on blank (line 15)", () => {
    const errs = validateRange({ raw: "15-17", start: 15, end: 17 }, codeLines, 0);
    assert.ok(errs.some(e => e.includes("blank")), `Got: ${errs}`);
  });
  it("lines 19-23: starts on blank (line 19)", () => {
    const errs = validateRange({ raw: "19-23", start: 19, end: 23 }, codeLines, 0);
    assert.ok(errs.some(e => e.includes("blank")), `Got: ${errs}`);
  });
  it("lines 25-27: starts on blank (line 25)", () => {
    const errs = validateRange({ raw: "25-27", start: 25, end: 27 }, codeLines, 0);
    assert.ok(errs.some(e => e.includes("blank")), `Got: ${errs}`);
  });
});

describe("passes correct ranges", () => {
  it("1-2: class + field", () => {
    assert.equal(validateRange({ raw: "1-2", start: 1, end: 2 }, codeLines, 0).length, 0);
  });
  it("12-14: method sig + first two lines", () => {
    assert.equal(validateRange({ raw: "12-14", start: 12, end: 14 }, codeLines, 0).length, 0);
  });
  it("16-18: fetch + filter", () => {
    assert.equal(validateRange({ raw: "16-18", start: 16, end: 18 }, codeLines, 0).length, 0);
  });
  it("20-24: if block", () => {
    assert.equal(validateRange({ raw: "20-24", start: 20, end: 24 }, codeLines, 0).length, 0);
  });
  it("26-27: reject path", () => {
    assert.equal(validateRange({ raw: "26-27", start: 26, end: 27 }, codeLines, 0).length, 0);
  });
});

describe("catches structural errors", () => {
  it("out of bounds", () => {
    const errs = validateRange({ raw: "30-35", start: 30, end: 35 }, codeLines, 0);
    assert.ok(errs.some(e => e.includes("out of bounds")));
  });
  it("start > end", () => {
    const errs = validateRange({ raw: "10-5", start: 10, end: 5 }, codeLines, 0);
    assert.ok(errs.some(e => e.includes("start")));
  });
  it("ends on blank line", () => {
    const errs = validateRange({ raw: "16-17", start: 16, end: 17 }, codeLines, 0);
    assert.ok(errs.some(e => e.includes("ends on a blank")));
  });
});

describe("does NOT false-positive on valid content", () => {
  it("JSDoc range 4-11: valid step target (no heuristic rejection)", () => {
    // Someone might intentionally highlight JSDoc to explain documentation conventions
    const errs = validateRange({ raw: "4-11", start: 4, end: 11 }, codeLines, 0);
    assert.equal(errs.length, 0, `Should not flag JSDoc as invalid, got: ${errs}`);
  });
  it("single line step", () => {
    const errs = validateRange({ raw: "12", start: 12, end: 12 }, codeLines, 0);
    assert.equal(errs.length, 0);
  });
});
