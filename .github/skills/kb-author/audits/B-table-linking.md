# Audit B — Reference-table linking

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
