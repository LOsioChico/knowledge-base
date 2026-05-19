
# Audit S5 — Code fences and MDX syntax (published site)

Run on every `.mdx` you touch.

## Copy-pasteable TypeScript

Same bar as vault audit A: full imports, class wrappers, no undefined symbols. Prefer `ts twoslash` when types teach.

## Shell placeholders in AWS recipes

| Fence | Placeholder style | Why |
| --- | --- | --- |
| `bash` | `$VAR` or `"$VAR"` in commands; `${VAR}` inside double-quoted strings and heredocs | Shiki highlights shell variables |
| `json` (static file user edits by hand) | Angle brackets `<SRC_BUCKET>` only when there is no export block | Valid JSON; no `$` prefix (invalid in JSON strings) |
| Policy tied to `export` block above | `bash` + unquoted heredoc (`<<EOF`) emitting `.json` | `${ACCOUNT_A_ID}` expands at write time and highlights as shell |

Do not put bare `ACCOUNT_A_ID` in a `json` fence when the recipe already exports shell variables: use a heredoc in `bash` instead.

## MDX expression hazards

| Pattern | Risk | Fix |
| --- | --- | --- |
| `` `${id}` `` or `{foo}` in **prose** (outside fences) | MDX treats `{` as JSX | Use string concat in prose, or keep inside fenced blocks |
| `[[slug\|label]]` inside **table rows** (`\| col \|`) | Pipe splits the wikilink; renders as `[[slug` | Use `[label](/knowledge-base/slug/)` in tables; wikilinks are fine in body bullets |
| `<Steps>` with `###` headings or extra `<Aside>` between steps | Starlight expects one `<ol>` | Use `## N. Title` sections for long CLI recipes, or numbered list items only inside `<Steps>` |

Enforced: `bun run lint:mdx-table-wikilinks` (table alias rule).

## Twoslash

Default on teaching fences. Do not add hover-tutorial sections on every page.
