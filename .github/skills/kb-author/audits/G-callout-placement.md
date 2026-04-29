# Audit G — Callout placement (place at first use, not in topical clusters)

A callout (`> [!warning]-`, `> [!info]-`, `> [!tip]-`, `> [!example]-`) explains, qualifies, or
elaborates on something the reader just encountered. Its placement signals what triggers it.

Two valid placements:

1. **Inline (preferred for snippet-specific callouts).** A callout that elaborates on a specific
   line, snippet, flag, or claim sits **immediately after the trigger** — the line that
   introduces the thing it's about. The reader hits the trigger, then the callout, then keeps
   going. Example: a `[!info]- The -c flag controls prefix colors` callout belongs right after
   the first `concurrently -c auto …` snippet, not three sections later.
2. **Trailing "Gotchas" / "See also" cluster (only for cross-cutting callouts).** A callout that
   warns about a concern that applies across the whole recipe (or to a configuration choice the
   reader hasn't seen yet but will hit eventually) can live in a trailing `## Gotchas` section.
   Example: "useGlobalGuards skips microservice gateways in hybrid apps" applies to anyone using
   the recipe with a hybrid app — there's no single trigger line.

The smell:

- A callout in a trailing cluster whose first sentence references **a specific snippet, file,
  flag, or step earlier in the note** ("the `-c` flag", "step 4's `nest g app` command", "the
  `main.ts` you generated above"). That callout's trigger is in the body — move it next to the
  trigger.
- Multiple callouts stacked back-to-back with no prose between them, all about different
  triggers. Split them and place each next to its trigger.
- A reader having to scroll down to learn that a snippet they just ran has a known footgun. If
  the footgun bites *the moment they run the snippet*, the callout was placed too late.

Audit procedure:

1. List every callout in the diff: `rg -n '^> \[!' <file>`.
2. For each, read its first sentence. Does it reference a specific line/snippet/flag earlier in
   the note?
   - **Yes** → move it to immediately after that line. Tweak the wording so it points forward
     ("see [step N](#…)") instead of backward ("the snippet above").
   - **No** (it's a general concern that applies broadly) → leave it in the trailing cluster.
3. After moving, verify no two callouts in the trailing cluster collapse to "this only applies
   if you used config X" — those should also migrate to where X is introduced.

Trailing-cluster sections (`## Gotchas`, `## See also`) are still valuable: they catch readers
who land via search and skim from the bottom up. Keep callouts there when they're cross-cutting.
