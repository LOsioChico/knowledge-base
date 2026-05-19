# Audit S1 — MDX publish bar (re-author, not paste)

**Fails** if the MDX page could have been produced by copying the vault `.md` into `sites/docs/` with
minimal find-replace. **Passes** if the page is structured for someone who has **never** opened the
Obsidian vault.

## Paste test (30 seconds)

Read the MDX page without the vault open. Ask:

1. Does the **first screen** tell me what problem this page solves?
2. Is there a **concrete path** (Steps, numbered setup, or symptom table) before deep reference material?
3. Are vault-only concerns (long audit chains, `related:` dumps, discoverability asides) **absent**?
4. Is anything **shorter** than the vault because redundancy was cut, not because facts were dropped?
5. Does **every fenced command block** have prose immediately above it that says **why** to run it and what to check in the output? (A heading alone is not enough.)

If (1), (2), or (5) is no → restructure before enriching.

## What to add (not in vault)

| Add on Starlight | Why |
| --- | --- |
| Symptom → fix / layer table | Debugging without reading the whole pipeline |
| TL;DR on MOCs and area indexes | Orientation in one pass |
| Tabs for real forks (global vs module, `useGlobalX` vs `APP_*`) | Compare alternatives side by side |
| Steps for procedures | Recipes and first-time setup |
| Mermaid only when order matters | Pipeline, FILO, decision flow — not decoration |
| Show-dont-tell JSON (recipes) | Prove 400/403/404 shapes |

## What to drop or defer

- Duplicate tables that repeat the sidebar
- Every vault gotcha callout — keep highest-signal footguns as `<Aside>`
- Deep edge cases with no primary source in session — link to official docs instead of guessing
- `// ^?` Twoslash tours and "hover the type" prose

## Anti-patterns (fail S1)

- **Command dumps**: a section heading then a bash fence with no "why" (e.g. pre-flight
  `sts get-caller-identity` with no explanation that wrong `Account` means you will corrupt the
  wrong account).
- **Stripping teaching prose from recipes** while keeping commands: pre-flight checks, KMS
  dual-policy warnings, share confirmation, copy-before-restore rationale, and cleanup ordering.
- Pasting vault `.md` with only callout/HTML rewrites — that is not re-authoring.

## Vault sync

Facts must still match verified sources. If MDX **simplifies**, the simplification must remain
**true**. When in doubt, keep the vault note authoritative for audit history; the published page
must still cite primary sources inline or in prose links.
