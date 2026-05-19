# Publishing on Starlight

The public site is **Starlight only** (`sites/docs/` → GitHub Pages at `/knowledge-base`).
GitHub Pages serves **Starlight only** (`sites/docs/dist/`). The vault is not published as HTML.

## Layout

| Path | Role |
| --- | --- |
| `sites/docs/src/content/docs/**/*.mdx` | **Canonical published pages** |
| `content/**/*.md` | **Legacy** (pre-migration; **do not edit**). Parity check only: each MDX slug must have a matching vault path (`lint:publish-parity`) |
| `sites/docs/astro.config.mjs` | Sidebar |

## Skills (one workflow)

Load **kb-author** (`.github/skills/kb-author/SKILL.md`):

- Vault edits: audits **A–P**, `bun run lint:wikilinks`, optional LLM audit on `content/`
- Published MDX: audits **S1–S6**, `bun run lint:docs`, `bun run docs:build`

There is no separate Starlight skill. LLM judges (`kb-auditor`, etc.) still run on vault markdown only.

## Per-page workflow (MDX)

1. Verify facts against primary sources (do not treat `content/` as authoritative; it is stale).
2. Author `sites/docs/src/content/docs/<area>/<slug>.mdx` — **re-author**, not paste ([S1](../.github/skills/kb-author/audits/S1-publish-bar.md)).
3. Run audits **S1–S6** ([index](../.github/skills/kb-author/SKILL.md#starlight-mdx-audits-published-site)).
4. `bun run lint:docs` and `bun run docs:build`.
5. Update sidebar and area MOC CardGrid; fix any `[[wikilinks]]` on other MDX pages.
6. `lint:publish-parity` must still pass (MDX slug has a matching `content/` path; **do not** edit vault body to sync).

**Sign-off:** a reader can answer *where this fits*, *when to use it*, and *what failure looks like* from the published page alone.

## Links in MDX

| Use | Syntax |
| --- | --- |
| Another published page (prose, lists) | `[[nestjs/fundamentals/pipes\|Pipes]]` |
| Another published page (**table cell**) | `[Pipes](/knowledge-base/nestjs/fundamentals/pipes/)` — table `\|` breaks `[[slug\|label]]` |
| Official / GitHub primary source | `https://docs.nestjs.com/...` |
| **Forbidden** for on-site topics | `https://losiochico.github.io/knowledge-base/...` |

`bun run lint:mdx-link-hygiene --strict` and `bun run lint:mdx-table-wikilinks` enforce this.

## Local commands

```bash
bun run docs:dev
bun run lint:docs
bun run docs:build
bun run lint:ci          # vault + Starlight + tests (CI)
```

## CI / deploy

See [`PIPELINE.md`](PIPELINE.md). Summary: `lint` job → Starlight `build` → deploy `sites/docs/dist/`.

## MDX capabilities

[`STARLIGHT-FEATURES.md`](STARLIGHT-FEATURES.md) — Twoslash, components, link styling.
