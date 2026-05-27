# Audit S4 — Enrichment fit (MDX)

Components must **reduce cognitive load**, not decorate.

## Decision tree (Starlight-native components)

```
Is the reader following a sequence they will execute?
  yes → <Steps>
  no ↓
Are there 2–4 real alternatives (not "more info")?
  yes → <Tabs> / <TabItem>
  no ↓
Is this a footgun that would interrupt the main flow?
  yes → <Aside type="caution|danger|note">
  no ↓
Does order/spatial structure teach (pipeline, FILO, decision flow)?
  yes → mermaid (keep ≤10 nodes)
  no → plain heading + prose/table
```

## Interactive components

When the concept shape goes beyond what Starlight-native components can teach (type evolution,
parallel timelines, architecture layers, decision trees with branching), load the
[**`kb-enrichment` skill**](../kb-enrichment/SKILL.md) for the mandatory selection framework
(Q1–Q10), validation checks, anti-patterns, and placement rules.

**Do NOT add interactive components without loading that skill first.**

API reference (props, slots, examples) lives in the component
[README.md](../../../sites/docs/src/components/interactive/README.md).

## Component rules (Starlight-native)

| Component | Use | Don't use |
| --- | --- | --- |
| `<Steps>` | Install → configure → verify; pipeline walk; RolesGuard recipe | Theory-only pages with no procedure |
| `<Tabs>` | `useGlobalX` vs `APP_*`; whitelist strip vs reject; Jest vs Vitest | Single-option explanations |
| `<Aside>` | One footgun per Aside; titled | Walls of five Asides in a row |
| `<CardGrid>` | Area MOC, fundamentals MOC, recipes MOC | Individual concept pages |
| `mermaid` | Request pipeline, interceptor FILO, global-provider decision | Sequence diagrams for 2-box flows |

## Aside types (Starlight)

| type | Intent |
| --- | --- |
| `note` | Side fact, cross-link, "not the other lifecycle" |
| `caution` | Footgun, easy misconfiguration |
| `danger` | Security / data-loss class (whitelist off, mass assignment) |

No `[!tip]`, `[!success]`, etc. (only the four canonical callout types).

## Decoration test

Remove a component mentally. If the page is **equally clear**, remove it.

**Interactive components carry JS weight.** If `<Steps>` or `<Tabs>` would be equally clear, use the lighter static component. Interactive is the last branch of the decision tree, not the first.

## Minimum bar

Every published MDX page needs **at least one** structural aid (table, Steps, Tabs, Aside, or mermaid)
**unless** the page is a deliberately minimal stub (prefer not to ship stubs — keep them as drafts until enriched).
