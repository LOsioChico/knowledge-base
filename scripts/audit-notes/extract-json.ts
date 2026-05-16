// Extract a JSON object from arbitrary assistant text.
//
// Strategy: prefer the last fenced ```json block (assistant reliably emits
// the schema-conformant payload last). Fall back to the last balanced
// top-level `{...}` substring that JSON.parse accepts. We scan for the
// longest balanced object because the assistant often narrates findings
// first, and prose can quote code containing stray `{` (e.g.
// `import { Foo } from '...'`) that a "first `{`" strategy misparses.
export function extractJson(text: string): string {
  const fenceRe: RegExp = /```json\s*\n([\s\S]*?)\n```/g;
  let lastFence: string | null = null;
  for (let m: RegExpExecArray | null; (m = fenceRe.exec(text)) !== null; ) {
    lastFence = m[1] ?? null;
  }
  if (lastFence !== null) {
    try {
      JSON.parse(lastFence);
      return lastFence;
    } catch {
      // fall through to balanced-scan
    }
  }
  let best: string | null = null;
  for (let start: number = 0; start < text.length; start++) {
    if (text[start] !== "{") continue;
    let depth: number = 0;
    let inString: boolean = false;
    let escape: boolean = false;
    for (let i: number = start; i < text.length; i++) {
      const ch: string = text[i] ?? "";
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate: string = text.slice(start, i + 1);
          try {
            JSON.parse(candidate);
            if (best === null || candidate.length > best.length) {
              best = candidate;
            }
          } catch {
            // not parseable; ignore
          }
          break;
        }
      }
    }
  }
  if (best !== null) return best;
  throw new Error("no parseable JSON object found in assistant output");
}
