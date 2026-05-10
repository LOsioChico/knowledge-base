// Self-consistency voting for LLM judge passes.
//
// Why: empirical measurement across 6 audit runs showed ~74% of unique
// jargon/source-verify findings appear in only 1 of 3 runs (sampling noise),
// while real findings re-appear 2/3 or 3/3. Majority voting (k>=2 of n=3)
// suppresses the 1/n noise floor without dropping stable findings.
//
// The wrapper is generic: each pass provides a per-sample runner, a signature
// function (used to bucket "the same finding" across samples), and an
// annotator that tags the surviving finding with its [k/n] vote count.
//
// N and threshold are env-tunable so a future cost-vs-recall sweep can adjust
// without code changes. N=1 short-circuits to a single sample (no voting).

import type { FlatFinding } from "./types.js";

export interface VotingConfig {
  n: number;
  threshold: number;
}

export function readVotingConfig(): VotingConfig {
  const nRaw: string | undefined = process.env.AUDIT_VOTE_N;
  const tRaw: string | undefined = process.env.AUDIT_VOTE_THRESHOLD;
  const n: number = nRaw !== undefined ? Math.max(1, parseInt(nRaw, 10)) : 3;
  const threshold: number =
    tRaw !== undefined ? Math.max(1, parseInt(tRaw, 10)) : 2;
  return { n, threshold: Math.min(threshold, n) };
}

// Run `runOnce` n times in parallel, bucket by `sigOf`, keep findings that
// reached the vote threshold, and annotate each with its [k/n] tally.
//
// Parallel-within-file (not serial) because Cursor agent latency dominates;
// the file-level concurrency cap upstream still bounds peak in-flight calls.
export async function runWithVoting(
  cfg: VotingConfig,
  runOnce: (sampleIdx: number) => Promise<FlatFinding[]>,
  sigOf: (f: FlatFinding) => string,
  log: (msg: string) => void,
  label: string,
): Promise<FlatFinding[]> {
  if (cfg.n <= 1) return runOnce(0);

  const samples: FlatFinding[][] = await Promise.all(
    Array.from({ length: cfg.n }, (_, i: number): Promise<FlatFinding[]> =>
      runOnce(i),
    ),
  );

  // Bucket by signature. Within one sample, dedupe (a single LLM run rarely
  // emits the same signature twice but we don't want a self-duplicate to count
  // as 2 votes). Across samples, count distinct samples that emitted the sig.
  const counts: Map<string, number> = new Map();
  const exemplar: Map<string, FlatFinding> = new Map();
  for (const sample of samples) {
    const seenInSample: Set<string> = new Set();
    for (const f of sample) {
      const sig: string = sigOf(f);
      if (seenInSample.has(sig)) continue;
      seenInSample.add(sig);
      counts.set(sig, (counts.get(sig) ?? 0) + 1);
      if (!exemplar.has(sig)) exemplar.set(sig, f);
    }
  }

  const kept: FlatFinding[] = [];
  let dropped: number = 0;
  for (const [sig, k] of counts) {
    const f: FlatFinding = exemplar.get(sig)!;
    if (k >= cfg.threshold) {
      kept.push({ ...f, message: `${f.message} [${k}/${cfg.n} votes]` });
    } else {
      dropped++;
    }
  }
  log(
    `[voting] ${label}: ${counts.size} unique across ${cfg.n} samples; kept ${kept.length} (>=${cfg.threshold}/${cfg.n}), dropped ${dropped} below threshold`,
  );
  return kept;
}
