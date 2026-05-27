---
name: kb-enrichment
description: >
  Interactive component selection and placement for Starlight MDX pages. Covers the
  mandatory decision tree (Q1–Q10), validation checks, anti-patterns, placement rules,
  and deployment checklist. Load when adding or auditing interactive components under
  sites/docs/. Triggers: interactive component, enrichment, /kb-enrichment, S4 audit.
---

# kb-enrichment

Workflow for selecting, validating, and placing interactive components in Starlight MDX
pages under `sites/docs/src/content/docs/`.

**API reference** (props, slots, examples) lives in the component
[README](../../../sites/docs/src/components/interactive/README.md). This skill owns
the **decision-making framework** — when to use which component, where to place it,
and what to avoid.

## When to load

User asks to: add/audit interactive components, enrich a page with visuals, run S4 audit,
or invokes `/kb-enrichment`. Also: any edit that adds an `import ... from '/src/components/interactive/...'`.

---

## Step 1 — Identify the concept shape (MANDATORY)

Ask these questions **in order**. Stop at the first YES.

```
Q1: Does the SAME entity execute code BOTH BEFORE and AFTER a core operation?
    (e.g., interceptors run pre-handler AND post-handler; spans wrap pre/post around inner ops)
    → YES: StackDiagram (wrapping/onion/FILO)

Q2: Is it a sequence where items are tried IN ORDER and the FIRST MATCH stops the search?
    (e.g., exception filter resolution: route→controller→global, first @Catch() wins)
    → YES: PipelineStrip (fallback/priority chain)

Q3: Is it a sequence where ALL items execute, one after another?
    (e.g., guards run global→controller→route, ALL must pass)
    → YES: PipelineStrip (linear pipeline)

Q3.5: Do MULTIPLE ENTITIES execute IN PARALLEL, with some BLOCKING/WAITING for others?
     (e.g., parent fiber runs while child fiber works, parent blocks on join)
     → YES: FiberTimeline (parallel swimlanes with active/blocked/idle states)

Q4: Is it a flow of MESSAGES between SEPARATE ACTORS over time?
    (e.g., producer→broker→consumer, saga choreography steps)
    → YES: FlowSimulator

Q5: Is the reader choosing between MULTIPLE OPTIONS based on their situation?
    (e.g., "which rate limiting algorithm?", "which NestJS layer?")
    → YES: DecisionGuide

Q6: Does tuning NUMERIC PARAMETERS reveal tradeoffs?
    (e.g., virtual nodes vs load balance, window size vs memory)
    → YES: ParameterPlayground

Q7: Is there a CODE BLOCK of 20+ lines with DISTINCT SECTIONS the reader must parse?
    → YES: CodeWalkthrough

Q8: Do TYPE SIGNATURES EVOLVE through a pipeline? (Effect-TS specific)
    → YES: TypeChannelTracer

Q9: Is it a LAYERED ARCHITECTURE where each layer has sub-components to explore?
    → YES: ArchitectureExplorer

Q10: None of the above fit cleanly?
     → Build a NEW component. Purpose-built > forced fit.
```

---

## Step 2 — Validate the selection (MANDATORY)

After choosing a component, verify ALL of these:

| Check | If it fails... |
|-------|----------------|
| **Mental model match**: Does the visual structure mirror the concept structure? | Wrong component — re-run Step 1. |
| **Beginner test**: Would someone new understand faster with this visual? | Skip the component — prose + Starlight `<Steps>` may be enough. |
| **Accuracy**: Is every label, tip, and description factually correct? | Fix the data — never invent behavior. |
| **No assumptions**: Does the component make sense without reading surrounding prose? | Add context to tips/descriptions. |
| **Interaction**: Does hover/click behavior match expectations? (no bubbling, clear affordances) | Fix CSS or pick a different component. |
| **Placement (explain-first rule)**: Has the reader already seen ALL concepts referenced in the component's labels, options, and results? A DecisionGuide asking "Ref vs STM?" is useless if the reader hasn't learned what Ref and STM are yet. | Move the component AFTER the sections that teach those concepts. Components consolidate and reinforce — they never introduce. |

---

## Step 3 — Anti-patterns (NEVER DO THESE)

| ❌ Wrong | ✅ Right | Why |
|----------|----------|-----|
| StackDiagram for a **fallback chain** (exception filters) | PipelineStrip | Filters are a priority search, not wrapping. The exception doesn't "pass through" layers — Nest checks each scope until one matches. |
| StackDiagram for a **linear sequence** (guards, pipe scopes) | PipelineStrip | Guards don't wrap — they execute and pass/fail. No "post" phase. |
| PipelineStrip for **before/after wrapping** (interceptors) | StackDiagram | Interceptors run pre AND post — the nesting IS the explanation. A flat pipeline hides FILO order. |
| FlowSimulator for **single-actor pipelines** | PipelineStrip | FlowSimulator needs separate actors (producer, broker, consumer). Same-actor stages use PipelineStrip. |
| FlowSimulator for **parallel execution with blocking** (fiber fork/join, backpressure) | FiberTimeline | FlowSimulator shows sequential hops. Concurrency is about things happening AT THE SAME TIME. FiberTimeline shows parallel lanes with active/blocked states. |
| DecisionGuide for **binary choices** | Prose or `<Tabs>` | Two options don't need a tree — a sentence or Tabs component is lighter. |
| CodeWalkthrough for **short code** (<15 lines) | Inline code block | The component overhead isn't worth it for code that fits on one screen. |
| Component **before its concepts are explained** | Move to after the last section it references | Interactive components consolidate knowledge — they never introduce it. The reader must understand every option/label/result before interacting. Place after the last concept it references, typically in a "Choosing the right X" section. |

### The key distinction: StackDiagram vs PipelineStrip

> **Does the same entity have a "before" phase AND an "after" phase that wraps a core?**
> - YES → StackDiagram (onion/FILO)
> - NO → PipelineStrip (linear/chain)

Examples:
- **Interceptors**: Same interceptor runs `pre` code, then `handler`, then `post` code → **StackDiagram** ✅
- **[[nestjs/fundamentals/exception-filters|Exception filters]]**: Nest searches route→controller→global, first match wins → **PipelineStrip** ✅
- **Guards**: Execute global→controller→route, first false stops → **PipelineStrip** ✅
- **Spans (observability)**: Same span wraps pre-work and post-work around inner operations → **StackDiagram** ✅

---

## Step 4 — Placement rules

| Component | Where to place | Why |
|-----------|---------------|-----|
| **PipelineStrip** | After the prose summary of the pipeline | Text-first overview, then visual reinforcement |
| **StackDiagram** | After the prose mentions wrapping or FILO order | Reader must know layers exist before seeing them nested |
| **CodeWalkthrough** | Wrap the existing code block in-place | Code block stays put |
| **TypeChannelTracer** | After the section explaining the referenced operations | Reader must understand the operations (pipe, gen, catchTag) before seeing type evolution |
| **DecisionGuide** | After ALL options are explained (never before) | Reader must understand every option before choosing |
| **FlowSimulator** | After the first prose explanation of the flow | Prose sets context; simulator lets reader replay |
| **FiberTimeline** | After the code showing the concurrent pattern | Reader must see the code first, then the timeline reveals parallelism |
| **ArchitectureExplorer** | After the architecture is introduced | Layer exploration supplements the prose overview |
| **ParameterPlayground** | After the algorithm explanation | Reader must understand what the parameters mean before tuning |

---

## Step 5 — If no component fits, build one

When Step 1 reaches Q10, don't force an existing component. Instead:

1. **Name the concept shape** you're trying to visualize
2. **Describe the interaction** the reader needs (hover? click? drag? animate?)
3. **Check existing components** — can you extend one with a new prop?
4. **If not**: create a new `.astro` file following the patterns in the components directory
5. **Add it to the README** with When to use / When NOT to use / Props / Anti-patterns

---

## Content text guidelines

All `body`, `label`, `note`, `explanation`, and `description` text in component props must:
- **Not assume prior knowledge** — if a step mentions "FILO" or "catchTag", explain what it means
- **Reference the page content** — use the same terminology and examples as the surrounding prose
- **Be self-contained** — a reader who only reads the interactive component should still learn something

---

## Decoration test (from S4 audit)

Remove a component mentally. If the page is **equally clear**, remove it.

**Interactive components carry JS weight.** If `<Steps>` or `<Tabs>` would be equally clear,
use the lighter static component. Interactive is the last branch of the decision tree, not the first.

---

## Boundaries

This skill owns the decision-making framework for interactive components. It does NOT own:
- **Component API** (props, slots, examples) → [README.md](../../../sites/docs/src/components/interactive/README.md)
- **Starlight-native components** (`<Steps>`, `<Tabs>`, `<Aside>`) → [S4 audit](../kb-author/audits/S4-enrichment-fit.md)
- **Note authoring workflow** → [kb-author](../kb-author/SKILL.md)
