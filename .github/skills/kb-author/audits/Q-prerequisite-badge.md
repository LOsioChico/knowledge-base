# Audit Q — Prerequisite Badge & Curriculum Progression

Ensure the "No Conceptual Leaps" rule is strictly maintained across the entire knowledge base. Every non-index page must clearly and visually establish its prerequisites so that a reader can traverse the vault along a sequential, self-teaching pathway.

## When this audit applies

- Every Starlight MDX note under `sites/docs/src/content/docs/**/*.mdx` (excluding track-level `index.mdx` Map of Content pages).

## Required Shape

Every non-index note must carry either a standard visual `<Aside>` badge block or a tagline-integrated inline citation to ensure there are no unanchored advanced concepts.

### 1. The Standard Badge Block (Preferred)
Placed immediately below the tagline blockquote, using the standard Starlight Aside component:

```html
<Aside type="tip" title="Prerequisites">
Before diving into this note, ensure you have read and understood:
- [[nestjs/fundamentals/modules|Modules]] — for encapsulation boundaries.
- [[nestjs/fundamentals/dependency-injection|Dependency Injection]] — for provider wiring.
</Aside>
```

### 2. The Inline Tagline Prerequisite (Compact Option)
For dense, highly-structured tracks (e.g., Effect-TS) where concepts form a tight chain, prerequisites can be integrated directly inside the tagline quote block:

```markdown
> How to acquire and safely release resources, ensuring leaks never happen.
> Prerequisite: [[effect-ts/scoped-resources|Scoped Resources]]
```

## Curriculum Progression Rules

1. **Immediate Predecessors Only**: Do not bloat the prerequisite list with the entire ancestor chain. Only list the immediate, direct step(s) required. If C requires B, and B requires A, C's prerequisite block should only cite B.
2. **Cognitive Hierarchy**: A note must never assume knowledge of highly advanced patterns without its prerequisite being listed. For example, a NestJS database recipe must cite the database configuration fundamental as a prerequisite, which in turn cites Dependency Injection.
3. **MOC Alignment**: The mapped prerequisites must perfectly align with the visual sequence flowchart (Mermaid diagram) displayed on the nearest track MOC `index.mdx`.
4. **Symmetric Relationship**: Ensure that the prerequisite notes are added to the current note's frontmatter `related:` list, maintaining perfectly symmetric linkages (enforced by `bun run lint:wikilinks`).

## Checklist

- [ ] The note has either a `<Aside type="tip" title="Prerequisites">` block or tagline-integrated `Prerequisite: [[link]]`.
- [ ] Prerequisites represent the immediate, most logical predecessors in the sequence.
- [ ] No advanced concept is assumed without a prerequisite representing it.
- [ ] The nearest MOC index flowchart reflects this sequential dependency.
