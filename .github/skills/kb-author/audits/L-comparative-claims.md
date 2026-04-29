# Audit L — Comparative claims

The most expensive hallucination is the comparative one. A claim of the form "behaves like X",
"same union as X", "X also returns Y", "mirrors X", "follows the X convention" is a hidden
**multi-source** claim: it asserts a property of the subject AND a property of the comparator,
and the natural failure mode is to verify the subject (you're writing about it, the source is
open) and write the analogy from memory about the comparator (you're not editing X's note today,
so you skip the lookup). The result reads as a confident, helpful framing and ships as a lie.

This audit fires every time a note adds a comparative claim. It is the operationalization of
the "Comparative claims are high-risk" bullet in [AGENTS.md "Sourcing rule"](../../../../AGENTS.md).

## Trigger phrases

Greppable patterns that almost always introduce a comparative claim:

- `same as`, `same union as`, `same shape as`, `same signature as`
- `just like`, `like X`, `mirror`, `mirrors`, `parallels`
- `also returns`, `also accepts`, `also takes`
- `follows the X convention`, `the X pattern`
- `unlike X`, `in contrast to X` (these assert a property of X by negation — equally risky)

```bash
# Run on touched notes before commit
grep -nE 'same (union|shape|signature|contract) as|just like|mirrors?|also (returns|accepts|takes)|follows the .* convention|unlike [A-Z]' <touched-files>
```

## Resolution checklist

For each hit, one of:

1. **Verify the comparator against its primary source in this session.** Open the comparator's
   interface file / docs page and confirm the property holds. Then the claim can stay (and the
   comparator's source URL goes in `source:`).
2. **Drop the comparison.** Replace it with a forward link to the comparator's note. Readers
   who care can follow the link; the note no longer asserts a fact it can't back. This is
   almost always the cheaper option: comparative framings rarely add as much as they cost.
3. **Move the fact.** If the comparison is really "X also has property P", the canonical place
   for "X has property P" is X's note (single-source-of-truth rule, AGENTS.md). Add it there
   if missing, link from the current note, and rewrite the current sentence to be about the
   subject only.

## Why this audit exists

April 29, 2026: a guard-return-shapes section claimed "same union as interceptors and pipes use
for their own returns." Verified guards (`boolean | Promise<boolean> | Observable<boolean>`)
from `CanActivate.canActivate`. Did NOT verify interceptors or pipes. Reality:

- Interceptors return `Observable<R> | Promise<Observable<R>>` (Observable required).
- Pipes return `R | Promise<R>` (no Observable).
- Middleware returns `void`.

The claim was wrong on two of three comparators. The note shipped, the user caught it. Audit L
is the post-mortem: every comparative claim must be treated as a multi-source claim from the
moment it's drafted.

## Audit procedure

1. Run the grep above on every file in your diff.
2. For each hit, decide: verify-and-cite, drop-and-link, or move-and-link.
3. Prefer drop-and-link when the comparison is decorative (i.e. "you might recognize this
   pattern from X"). Keep verify-and-cite only when the comparison is load-bearing for the
   reader's understanding.
4. Re-grep after edits to confirm clean.

The audit is cheap (one grep, a few seconds of judgement per hit). The bug it prevents is
expensive (silent misinformation that erodes the vault's trustworthiness).
