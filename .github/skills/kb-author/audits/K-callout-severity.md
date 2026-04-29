# Audit K — Callout severity

Callout type signals what the reader should DO with the information. Inflated severity (every
qualifier becomes `[!warning]`) trains readers to skim past warnings — including the real ones
that bite. Each callout earns its severity.

Decision tree:

| Severity | Trigger |
| --- | --- |
| `[!warning]` | Following the obvious code path causes a real failure: silent wrong behavior, hang, data loss, security hole, "you'll think the framework is broken". |
| `[!info]` | Clarifies non-obvious behavior or a rule. Ignoring it doesn't break anything; the reader just lacks context. |
| `[!tip]` | Optional improvement, alternative approach, "you could also...". |
| `[!example]` | Worked example with code. |
| `[!todo]` | Open follow-up, deferred work, "review on next release". Always collapsed (`[!todo]-`). |

The "would I be angry if I hit this in production?" test:

- **Yes, this would burn me** → warning.
- **I'd want to know but it's not catching me by surprise** → info.
- **Neat, didn't know that** → tip.

Real wild example caught in the wild: this audit fired on April 28, 2026 with 41 `[!warning]`
callouts vs 24 `[!info]` and 5 `[!tip]`. Warnings outnumbered every other type — almost always a
sign of severity inflation. After the sweep: 27 warnings, with the rest demoted to info.

Common downgrades:

- "Order matters" / "X runs after Y" → **info** (ordering fact, not a footgun, unless violating
  it silently corrupts behavior).
- "Clarifies what 'missing' means" / "What this flag actually covers" → **info**.
- "Alternative-comparison" ("don't use X as a substitute for Y") → **info** (advisory, not
  failure).
- "Convention guidance" ("pick one prefix and stick with it") → **info** or **tip**.
- "Behaviorally identical for most code, but if you rely on…" → **info** (the warning's own
  hedge gives it away).

Audit procedure:

1. List every callout: `grep -rnE '^> \[!' content/`.
2. For each `[!warning]`, read the body. Apply the "would I be angry?" test.
3. Downgrade if the answer is no. Aim for **warnings to be rare** — if they're the most common
   callout type, the audit failed.
4. Watch for **duplicates** while you're at it: two `[!warning]` callouts in the same Gotchas
   section that teach the same lesson should be merged into one.

Severity inflation is contagious: once a few weak warnings exist, future authors mirror the
pattern. Sweep periodically.
