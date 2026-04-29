---
name: kb-author
description: >
  Authoring and pre-commit audit workflow for personal markdown knowledge bases (Quartz, Obsidian,
  or any vault with frontmatter + wikilinks). Covers the pre-flight discovery ritual before drafting
  a note, the post-edit audit (code examples have all imports, reference tables link to their
  examples, sourcing is verified against primary sources), and the agents-mirror reminder. Use this
  skill when editing files under `content/`, `notes/`, `vault/`, or any folder of `.md` notes
  governed by an `AGENTS.md`. Triggers: "edit a note", "add a note", "audit content", "write a
  recipe", "update the knowledge base", "/kb-author".
---

# kb-author

Workflow skill for editing a personal markdown knowledge base. The repo's `AGENTS.md` is the
authority for invariants (frontmatter schema, controlled vocabulary, linker rules). This skill
carries the **multi-step workflows** that AGENTS.md only summarizes: how to discover existing
material before drafting, how to audit what you wrote before commit.

Always read the repo's `AGENTS.md` first — it has invariants and a controlled vocabulary that
override anything here.

## When to load

Load this skill when the user:

- Asks to add, edit, or expand a note
- Asks to write a recipe, fundamental, or reference page
- Asks to audit existing notes for missing imports, broken links, or undocumented references
- Mentions the knowledge base, vault, MOCs, or wikilinks
- Runs `/kb-author`

## Workflow 1 — Pre-flight discovery ritual (BEFORE drafting any note)

Skipping any step is a bug. Run from repo root:

```bash
# 1. Read the operating contract and the area MOC
bat AGENTS.md
bat content/<area>/index.md

# 2. Inventory the area
fd . content/<area> -e md

# 3. Search the whole vault for the concept and adjacent terms
rg -n -i '<keyword>|<synonym>|<adjacent-concept>' content

# 4. Inspect existing relationship metadata
rg -n '^(tags|aliases|area|related):' content -A 4

# 5. Read every candidate note that the searches surfaced
bat content/<area>/<candidate>.md
```

Only after these five steps may you draft. Then:

6. Add the note with the full frontmatter schema (see AGENTS.md).
7. Update `related:` in EVERY note you linked from.
8. Update the closest `index.md` MOC and, if a new area, `content/index.md`.
9. **Run the post-edit audit (Workflow 2).**
10. Mirror `AGENTS.md` → `.github/copilot-instructions.md` if AGENTS.md changed (`cp AGENTS.md .github/copilot-instructions.md`).
11. Run the linter: `npm run lint:wikilinks` (or whatever the repo defines).

## Workflow 2 — Post-edit audit (BEFORE commit)

Run these checks against every note you touched, including snippets inside
`> [!warning]` / `> [!example]` / `> [!info]` callouts.

### Audit A — Code examples (imports + wrappers + defined refs)

For every fenced ` ```ts ` / ` ```typescript ` block in the diff, verify:

1. **All imports are present.** Every symbol used (decorators, classes, RxJS operators,
   third-party packages, Node built-ins) has a matching `import` line at the top of the snippet.
2. **Class methods are wrapped in their container.** A `@Get()` / `@Post()` / `@Use()` method
   lives inside `@Controller(...) export class FooController { ... }`. A `@Module({...})` snippet
   has `export class FooModule {}`. No bare decorated methods floating outside a class.
3. **Class fields and constructors are declared.** If the body uses `this.store`, the field
   declaration must be visible. If `this.config` is accessed, the constructor must inject it.
4. **No undefined references.** Every symbol must be (a) imported, (b) defined earlier in the
   same snippet, or (c) explicitly commented as defined elsewhere.
5. **Single-line illustrative fragments are OK** only if surrounding prose makes context
   unambiguous. When in doubt, write the full snippet.

Heuristic grep to spot floating decorators (run from repo root):

```bash
# Decorated methods that aren't preceded by a class line within ~6 lines
rg -n -B6 '^\s*>?\s*@(Get|Post|Put|Patch|Delete|Use\w+|Inject\w*)\(' content | rg -B6 '@(Get|Post|Put|Patch|Delete|Use\w+|Inject\w*)\(' | head -80
```

When auditing a single file, just read every fenced block end-to-end.

### Audit B — Reference-table linking

When a note contains a reference table that enumerates entities (built-in pipes, built-in guards,
decorators, common operators, error symptoms, config flags, etc.), every row whose entity is
**demonstrated by a worked example** — same note OR another note — MUST link to that example from
the row's notes/description column.

- Cross-note targets: wikilink (`[[area/recipe-name|Recipe label]]`).
- In-note targets: plain markdown anchor (`[label](#section-slug)`). **Never** `[[note#Heading]]`
  on a self-reference — the linter rejects it.
- A row with no example to point to stays unlinked.

Audit procedure:

1. For each table row, identify the entity (e.g., `RolesGuard`, `ParseIntPipe`).
2. Search the vault: `rg -n '<EntityName>' content/`.
3. If a worked example exists and the row doesn't link to it → add the link.

### Audit C — First-mention wikilinks

The first time a concept that has its own note appears in the body of another note, it MUST be a
wikilink, not plain text. Subsequent mentions can stay plain. Code identifiers
(e.g. `FileInterceptor`) are not concepts; the underlying concept is
(`[[nestjs/fundamentals/interceptors|interceptor]]`). The lint catches this — but fix proactively
so the lint output stays empty.

### Audit D — `related:` ↔ body wikilinks consistency

If a body wikilink → `[[guards]]` exists, the target must be in `related:` of the source AND the
source must be in `related:` of the target (symmetry, enforced by lint).

### Audit E — Sourcing

Every technical claim must be backed by a primary source URL in the `source:` frontmatter list.
Surprising or version-specific claims also get an inline link next to the claim. Never write from
training-data memory.

### Audit F — Show, don't tell (recipes only)

For notes tagged `type/recipe`: every section that describes an observable behavior change
("returns 400", "strips field X", "rejects Y", "the response becomes Z") MUST include the
concrete request payload AND the resulting response payload in fenced blocks (JSON, curl, or a
constructed instance). Prose claims like "returns 400 with both messages" without the actual JSON
are the smell.

Audit procedure:

1. Search the diff for behavior-claim phrasing: `rg -n 'returns|strips|rejects|fails|coerce|becomes'`.
2. For each hit, check whether a request and response block sit next to it.
3. If not, add a `Request:` block (JSON / curl / constructed instance) and a `Response:` block
   (JSON / status code / error shape). Then trim the prose.

Fundamentals (`type/concept`, `type/pattern`) can stay narrative when the snippet alone makes the
behavior obvious.

### Audit G — Callout placement (place at first use, not in topical clusters)

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

### Audit H — Conceptual sections lead with a mental model

Any section that compares two similar concepts ("X vs Y"), explains a counterintuitive rule
(reversed resolution order, opposite-direction lifecycle), or introduces an abstract layer
should open with a one-sentence concrete analogy or framing **before** the technical details.

Examples that earned their hook:

- "Correlation ID = sticker, trace ID = sticker + GPS tracker" + a `Question → What you need` table.
- "Interceptors are the **sandwich**: bread (pre-phase) → filling (the handler) → bread (post-phase)."
- "Filters are the **last-chance handler**; the most specific filter wins, the global is the safety net."
- "`useGlobal*` is the **shortcut**; `APP_*` is the **DI-aware** version."

The smell: a section heading that's a comparison ("Why X, not Y"), an order/lifecycle rule, or a
"vs" table whose first paragraph dives into jargon (`ExecutionContext`, `useFactory`, `Reflector`,
`Scope.TRANSIENT`) without naming what the reader should picture first.

Audit procedure:

1. Skim every `##` / `###` heading in the diff. Flag any that compares concepts, contrasts a rule
   with the rest of the lifecycle, or names two similar things side-by-side.
2. For each flagged section, read the first paragraph. If it opens with technical detail, prepend
   a one-sentence analogy or "role" framing. Keep it concrete (sticker, sandwich, checkpoint,
   safety net, gatekeeper, GPS tracker) — abstract framings ("a unified abstraction over…")
   defeat the purpose.
3. If the comparison is a table, consider adding a `Question you want to answer | What you need`
   row pair above or below it — readers reach for the table when they have a real question.
4. Skip: procedural step-by-step recipes, reference tables of built-ins, code-only sections, and
   sections that already lead with a clear analogy.

The rule is "every comparison earns one analogy", not "sprinkle metaphors everywhere". One sharp
sentence beats a paragraph of cleverness.

## Workflow 3 — When you discover a repeated bug pattern

After fixing N≥2 instances of the same content bug (missing import, missing back-link from a
reference table, undefined symbol):

1. STOP further piecemeal fixes.
2. Propose encoding the rule in `AGENTS.md` (and mirror to `.github/copilot-instructions.md`).
3. Run a vault-wide audit pass against the new rule.
4. Fix everything the pass surfaces.
5. THEN resume normal work.

This is the "encode-then-audit" reflex. Don't wait for the user to ask.

## Common pitfalls

- **Skipping discovery ritual** → duplicate notes, broken backlinks, asymmetric `related:`.
- **Drafting code without final audit** → readers can't run the snippet (missing imports).
- **Adding a worked example without back-linking from the reference table** → discoverability bug.
- **Stacking callouts in a trailing Gotchas section when each one applies to a specific earlier
  snippet** → readers hit the footgun before reaching the warning. Place callouts at first use
  (Audit G).
- **Comparison or "X vs Y" section that opens with jargon and no analogy** → reader has to
  build the mental model from technical details. Lead with a one-sentence concrete framing
  (Audit H).
- **Using `[[note#Heading]]` for in-note anchors** → linter rejects as self-wikilink. Use
  `[label](#slug)` instead.
- **Editing AGENTS.md without mirroring** → CI fails on `agents-mirror` lint check.
- **Trusting schematic `schema.json` for `nest g` defaults** → the CLI action layer overrides them.
  Always run `--dry-run` first and trust terminal output.

## Boundaries

This skill is the workflow companion to the repo's `AGENTS.md`. It does NOT override AGENTS.md
invariants — schema, vocabulary, linker rules — those win on conflict. It does NOT run the lint
or the build itself; the agent invokes those commands.
