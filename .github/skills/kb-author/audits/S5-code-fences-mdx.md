
# Audit S5 — Code fences and MDX syntax (published site)

Run on every `.mdx` you touch.

## Copy-pasteable TypeScript

Same bar as vault audit A: full imports, class wrappers, no undefined symbols. Prefer `ts twoslash` when types teach.

## MDX expression hazards

| Pattern | Risk | Fix |
| --- | --- | --- |
| `` `${id}` `` or `{foo}` in **prose** (outside fences) | MDX treats `{` as JSX | Use string concat in prose, or keep inside fenced blocks |
| `[[slug\|label]]` inside **table rows** (`\| col \|`) | Pipe splits the wikilink; renders as `[[slug` | Use `[label](/knowledge-base/slug/)` in tables; wikilinks are fine in body bullets |
| `<Steps>` with `###` headings or extra `<Aside>` between steps | Starlight expects one `<ol>` | Use `## N. Title` sections for long CLI recipes, or numbered list items only inside `<Steps>` |

Enforced: `bun run lint:mdx-table-wikilinks` (table alias rule).

## Twoslash

Default on teaching fences. Do not add hover-tutorial sections on every page.
