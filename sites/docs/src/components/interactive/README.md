# Interactive Components

Custom Astro components for patterns where static enrichment (`<Steps>`, `<Tabs>`, `<Aside>`, mermaid) doesn't cover the teaching need.

**Rule of thumb:** if `<Steps>` or `<Tabs>` would be equally clear, use the lighter static component. Interactive components carry JS weight. Follow the [S4 enrichment decision tree](/.github/skills/kb-author/audits/S4-enrichment-fit.md).

## Component selection framework (MANDATORY)

Before adding ANY interactive component, follow this decision sequence **mechanically**. Do NOT skip steps or pattern-match by label.

### Step 1 — Identify the concept shape

Ask these questions **in order**. Stop at the first YES.

```
Q1: Does the SAME entity execute code BOTH BEFORE and AFTER a core operation?
    (e.g., interceptors run pre-handler AND post-handler; the same middleware wraps request AND response)
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

### Step 2 — Validate the selection (MANDATORY)

After choosing a component, verify ALL of these:

| Check | If it fails... |
|-------|----------------|
| **Mental model match**: Does the visual structure mirror the concept structure? | Wrong component — re-run Step 1. |
| **Beginner test**: Would someone new understand faster with this visual? | Skip the component — prose + Starlight `<Steps>` may be enough. |
| **Accuracy**: Is every label, tip, and description factually correct? | Fix the data — never invent behavior. |
| **No assumptions**: Does the component make sense without reading surrounding prose? | Add context to tips/descriptions. |
| **Interaction**: Does hover/click behavior match expectations? (no bubbling, clear affordances) | Fix CSS or pick a different component. |

### Step 3 — Anti-patterns (NEVER DO THESE)

| ❌ Wrong | ✅ Right | Why |
|----------|----------|-----|
| StackDiagram for a **fallback chain** (exception filters) | PipelineStrip | Filters are a priority search, not wrapping. The exception doesn't "pass through" layers — Nest checks each scope until one matches. |
| StackDiagram for a **linear sequence** (guards, pipe scopes) | PipelineStrip | Guards don't wrap — they execute and pass/fail. No "post" phase. |
| PipelineStrip for **before/after wrapping** (interceptors) | StackDiagram | Interceptors run pre AND post — the nesting IS the explanation. A flat pipeline hides FILO order. |
| FlowSimulator for **single-actor pipelines** | PipelineStrip | FlowSimulator needs separate actors (producer, broker, consumer). Same-actor stages use PipelineStrip. |
| FlowSimulator for **parallel execution with blocking** (fiber fork/join, backpressure) | FiberTimeline | FlowSimulator shows sequential hops. Concurrency is about things happening AT THE SAME TIME. FiberTimeline shows parallel lanes with active/blocked states. |
| DecisionGuide for **binary choices** | Prose or `<Tabs>` | Two options don't need a tree — a sentence or Tabs component is lighter. |
| CodeWalkthrough for **short code** (<15 lines) | Inline code block | The component overhead isn't worth it for code that fits on one screen. |

### The key distinction: StackDiagram vs PipelineStrip

This is the most common mistake. Use this test:

> **Does the same entity have a "before" phase AND an "after" phase that wraps a core?**
> - YES → StackDiagram (onion/FILO)
> - NO → PipelineStrip (linear/chain)

Examples:
- **Interceptors**: Same interceptor runs `pre` code, then `handler`, then `post` code → **StackDiagram** ✅
- **Exception filters**: Nest searches route→controller→global, first match wins → **PipelineStrip** ✅
- **Guards**: Execute global→controller→route, first false stops → **PipelineStrip** ✅
- **Middleware**: Each middleware calls next() and can run code after `res.on('finish')` → **StackDiagram** ✅ (if showing the wrap) or **PipelineStrip** (if showing the chain)

### Step 4 — If no component fits, build one

When Step 1 reaches Q10, don't force an existing component. Instead:

1. **Name the concept shape** you're trying to visualize
2. **Describe the interaction** the reader needs (hover? click? drag? animate?)
3. **Check existing components** — can you extend one with a new prop?
4. **If not**: create a new `.astro` file following the patterns in this directory
5. **Add it to this README** with When to use / When NOT to use / Props / Anti-patterns

### Questions to ask before every component usage

1. Does this component match the **mental model** of the concept?
2. Would a beginner understand this concept **faster** with this visual?
3. Is anything **assumed** that should be explained?
4. Should we **reference other notes** from this visual?
5. Is the data **accurate** (not editorial narration disguised as protocol)?
6. Does hovering and interaction feel right (no bubbling, proper indicators)?

## Import pattern

From any MDX page under `sites/docs/src/content/docs/`:

```mdx
import ShellSession from '/src/components/interactive/ShellSession.astro';
import BeforeAfter from '/src/components/interactive/BeforeAfter.astro';
import CodeWalkthrough from '/src/components/interactive/CodeWalkthrough.astro';
import TypeChannelTracer from '/src/components/interactive/TypeChannelTracer.astro';
import ParameterPlayground from '/src/components/interactive/ParameterPlayground.astro';
import DecisionGuide from '/src/components/interactive/DecisionGuide.astro';
import FlowSimulator from '/src/components/interactive/FlowSimulator.astro';
import ArchitectureExplorer from '/src/components/interactive/ArchitectureExplorer.astro';
import PipelineStrip from '/src/components/interactive/PipelineStrip.astro';
import StackDiagram from '/src/components/interactive/StackDiagram.astro';
```

## Components

---

### ShellSession

Fill-in-your-values form for CLI recipes. Renders an input bar at the top of a recipe page. When the reader fills in values, all bash/shell code blocks on the page update live — both visually and in the copy-to-clipboard button.

**When to use:** AWS CLI recipes where the reader must substitute their own account ID, region, bucket name, etc. across multiple code blocks.

**When NOT to use:** Non-CLI code blocks (TypeScript, JSON). The component only targets `bash`/`sh`/`shell`/`zsh` fenced blocks.

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `vars` | `Var[]` | yes | — | Variables to expose as inputs |
| `storageKey` | `string` | no | page pathname | localStorage key for persistence |

```typescript
interface Var {
  name: string;         // Variable name (e.g., "BUCKET")
  placeholder?: string; // Gray hint text (not a value)
  default?: string;     // Pre-filled value (editable)
  template?: string;    // Computed from other vars, e.g., "quickstart-${ACCOUNT_ID}-${REGION}"
                        // Makes this field read-only
}
```

#### Features

- Variables persist in `localStorage` per-page — no re-entering on revisit
- Template variables auto-compute when dependencies change
- Reset button clears all values
- Copy-to-clipboard on each code block copies the resolved command
- Replaced values are highlighted in accent color
- Without JS: code blocks display normally with `$VAR` syntax

#### Example

```mdx
<ShellSession
  vars={[
    { name: "AWS_PROFILE", placeholder: "your-profile" },
    { name: "REGION", default: "us-east-1" },
    { name: "ACCOUNT_ID", placeholder: "111122223333" },
    { name: "BUCKET", template: "quickstart-${ACCOUNT_ID}-${REGION}" },
  ]}
/>
```

#### Target notes

| Note | Variable refs |
|------|--------------|
| `aws/rds/cross-account-snapshot` | 32 |
| `aws/eventbridge/quickstart` | 29 |
| `aws/s3/cross-account-migration` | 19 |
| `aws/sqs/quickstart` | 14 |
| `aws/s3/quickstart` | 14 |

---

### PipelineStrip

Vertical card-based pipeline diagram. Each stage is a bordered card with a numbered circle, colored left border, and inline description. Supports single or multiple zones that group stages in dashed-border panels with custom colors.

**When to use:** Linear flows with 3-10 stages (request pipeline, middleware chains, saga steps).

**When NOT to use:** Branching flows (→ FlowSimulator). Wrapping/nesting (→ StackDiagram).

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `stages` | `Stage[]` | yes | — | Ordered stages |
| `title` | `string` | no | — | Header above the strip |
| `zone` | `Zone` | no | — | Single zone (backward compat) |
| `zones` | `Zone[]` | no | — | Multiple zones (takes precedence over `zone`) |

```typescript
interface Stage {
  label: string;   // Display name
  color?: string;  // CSS color for left border + badge
  href?: string;   // Link (anchor or page)
  tip?: string;    // Inline description text
}

interface Zone {
  start: number;   // First stage index (0-based)
  end: number;     // Last stage index (inclusive)
  label: string;   // Zone header text
  tip?: string;    // Subtitle below label
  href?: string;   // Link target
  color?: string;  // CSS color for zone border/label (default: red #f87171)
  icon?: string;   // Emoji before label (default: ⚡)
}
```

#### Key design decisions

- **Vertical layout**: 7+ stages don't fit horizontally; vertical cards are always readable.
- **Multi-zone**: supports any number of zones with custom colors/icons. Stages outside zones render as standalone cards.
- **Segments model**: stages are grouped into zone-panels and standalone-card groups in frontmatter.
- **Inner arrows**: consecutive cards inside a zone get small `↓` pseudo-element arrows via CSS.
- **No JS**: pure CSS hover effects and transitions.

#### Astro template gotcha

Never use `<=`, `>=`, or `<>` in the Astro template section (after `---`). The compiler reads `<` as a tag opener. Do all comparisons in the frontmatter block.

#### Example

```mdx
<PipelineStrip
  title="Request flow"
  zone={{ start: 1, end: 5, label: "Exception zone", tip: "Exception Filters catch errors here.", href: "/knowledge-base/nestjs/fundamentals/exception-filters/" }}
  stages={[
    { label: "Middleware", color: "#a78bfa", href: "/knowledge-base/nestjs/fundamentals/middleware/", tip: "Logging, CORS, body parsing." },
    { label: "Guards", color: "#f59e0b", tip: "canActivate() — returns false → 403." },
    { label: "Interceptors ⟨pre⟩", color: "#60a5fa", tip: "Code before next.handle()." },
    { label: "Pipes", color: "#34d399", tip: "Transform & validate." },
    { label: "Controller", color: "#f472b6", tip: "Your handler method." },
    { label: "Interceptors ⟨post⟩", color: "#60a5fa", tip: "Code after next.handle()." },
    { label: "Response", color: "#94a3b8" },
  ]}
/>
```

#### Current usages

| Note | Purpose |
|------|---------|
| `nestjs/fundamentals/request-lifecycle` | Full 7-stage request pipeline with exception zone |

---

### StackDiagram

Concentric nested layers showing wrapping/onion behavior. Each layer wraps inner layers with pre/post code, making FILO execution order visually obvious. Step numbers show the exact execution sequence.

**When to use:** Concepts where the same entity wraps both sides of a core operation (interceptors, middleware chains, decorator stacking, Russian-doll patterns).

**When NOT to use:** Linear sequences without wrapping — use PipelineStrip. Message passing — use FlowSimulator.

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `layers` | `Layer[]` | yes | — | Layers in outside-in order |
| `core` | `Core` | yes | — | Innermost element |
| `title` | `string` | no | — | Header above the diagram |

```typescript
interface Layer {
  label: string;   // Layer name (e.g. "Global Interceptor")
  color: string;   // CSS color for border and label
  pre: string;     // What runs on the way IN
  post: string;    // What runs on the way OUT
}

interface Core {
  label: string;   // Core element name (e.g. "Handler")
  color: string;   // CSS color
  tip?: string;    // Description text
}
```

#### Key design decisions

- **Nesting IS the explanation**: no arrows or "FILO" labels needed — the visual structure teaches the concept.
- **Step numbers**: computed automatically. Pre runs outside-in (①②③), core is the middle step (④), post runs inside-out (⑤⑥⑦).
- **Direction arrows**: `pre →` (going in) and `← post` (coming out) reinforce flow direction.
- **Isolated hover**: only the directly-hovered layer highlights (`:has()` prevents ancestor bubbling).
- **No JS**: pure CSS transitions.

#### Example

```mdx
<StackDiagram
  title="FILO interceptor execution order"
  layers={[
    { label: "Global Interceptor", color: "#60a5fa", pre: "Start timer, log inbound request", post: "Log elapsed time, see final transformed response" },
    { label: "Controller Interceptor", color: "#818cf8", pre: "Controller-scoped logic", post: "Transform response after route-level changes" },
    { label: "Route Interceptor", color: "#a78bfa", pre: "Route-specific cache check", post: "map() to add route metadata" },
  ]}
  core={{ label: "Handler", color: "#f472b6", tip: "Your @Get()/@Post() method" }}
/>
```

#### Current usages

| Note | Purpose |
|------|---------|
| `nestjs/fundamentals/interceptors` | FILO execution order — 3 concentric interceptor layers wrapping the Handler |

---

### BeforeAfter

Draggable split-pane comparison. The reader drags a divider to see both sides simultaneously.

**When to use:** Architectural or code comparisons where seeing both sides at once matters.

**When NOT to use:** Simple "here's the new code" — use Expressive Code `ins=/del=` diff markers.

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `beforeLabel` | `string` | no | `"before"` | Left side label |
| `afterLabel` | `string` | no | `"after"` | Right side label |
| `title` | `string` | no | — | Optional header |
| `split` | `number` | no | `50` | Initial split (0-100) |

#### Slots

| Slot | Purpose |
|------|---------|
| `before` | Content for the left side |
| `after` | Content for the right side |

#### Target notes

- `system-design/consistent-hashing` — mod-N vs ring
- `effect-ts/layers-vs-nestjs-di` — Effect Layers vs NestJS DI

---

### CodeWalkthrough

Step-by-step annotated code walkthrough. The reader clicks through regions of a code block; the current region is highlighted (non-active lines dim) and an explanation panel shows context for that region.

**When to use:** Code blocks of 20+ lines where the reader needs to understand distinct sections: algorithms, multi-step setups, framework wiring patterns.

**When NOT to use:** Short code blocks (< 15 lines) where the full picture is immediately clear. One-liner examples.

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `steps` | `Step[]` | yes | — | Ordered walkthrough steps |
| `title` | `string` | no | — | Optional header title |

```typescript
interface Step {
  lines: string;   // Line range, e.g. "1-5" or "12"
  title: string;   // Short step title
  body: string;    // Explanation text
}
```

#### Features

- Wraps any Expressive Code block (keeps syntax highlighting, twoslash, line numbers)
- Non-active lines fade to 25% opacity; active lines get accent background
- Side panel shows step title + explanation (stacks below code on mobile)
- Navigation: prev/next buttons, progress dots, keyboard arrows
- Auto-scrolls code panel to show the highlighted region
- Without JS: all step annotations still visible (no content hidden)
- Print: all steps shown, no dimming

#### Controls

| Control | Action |
|---------|--------|
| `← / →` buttons | Previous / next step |
| Progress dots | Click to jump to any step |
| Arrow keys | Navigate when component is focused |

#### Example

```mdx
<CodeWalkthrough
  title="consistent hash ring"
  steps={[
    { lines: "1-5",   title: "Hash function",        body: "MD5 produces a hex string. We take only 8 chars (32 bits) to map any key to a position 0–4.3 billion on the ring." },
    { lines: "7-11",  title: "Ring data structure",   body: "A Map from hash positions to server names, plus a sorted array of positions for binary search." },
    { lines: "13-18", title: "Adding a server",       body: "Each physical server gets V virtual nodes scattered across the ring. Re-sort after adding." },
    { lines: "20-28", title: "Clockwise lookup",      body: "Binary search finds the first position ≥ the key's hash. Modulo wraps around to the ring's start." },
  ]}
>

` ` `typescript
// your code block here
` ` `

</CodeWalkthrough>
```

#### Target notes

| Note | Code block | Lines | Why it helps |
|------|-----------|-------|-------------|
| `system-design/consistent-hashing` | ConsistentHashRing class | ~100 | Step through add → remove → lookup → simulation |
| `system-design/rate-limiting` | SlidingWindowLimiter + Lua | ~80 | See prune → check → append as a sequence |
| `effect-ts/typed-errors` | Full pipeline | ~40 | Follow error narrowing step by step |
| `nestjs/fundamentals/request-lifecycle` | CatsController | ~40 | Click each decorator to see its pipeline stage |
| `nestjs/auth/jwt-strategy` | Strategy + Guard + Module | ~50 | See the three-piece auth wiring connected |
| `nestjs/recipes/dynamic-modules` | DynamicModule.register() | ~30 | Trace config → factory → module wiring |
| `effect-ts/fault-tolerant-ingestion` | Ingestion pipeline | ~50 | Complex composed Effect pipeline |

---

### TypeChannelTracer

Visualizes how Effect-TS type signatures (`Effect<A, E, R>`) evolve through a composition pipeline. Each step shows the operation applied, with the A and E channels displayed separately. Error tags are color-coded for additions (green) and removals (red strikethrough). A small `Effect<A, E>` full signature appears below.

**When to use:** Effect-TS notes where the reader needs to track how the error channel `E` narrows (via `catchTag`) or widens (via `gen`/composition).

**When NOT to use:** Simple one-step examples. Non-Effect code.

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `steps` | `Step[]` | yes | — | Ordered pipeline steps |
| `title` | `string` | no | — | Optional header title |

```typescript
interface Step {
  op: string;         // Operation applied (e.g., "catchTag('NotFoundError', ...)")
  a: string;          // Success channel type (e.g., "string")
  e: string;          // Error channel type (e.g., "NetworkError | ParseError" or "never")
  removed?: string[]; // Error tags removed at this step (shown in red strikethrough)
  note?: string;      // Optional annotation
}
```

#### Features

- Interactive timeline with hover-preview and click-lock navigation
- CSS crossfade between states (no layout shift)
- Two-line display: A channel and E channel shown separately
- Small `Effect<A, E>` full signature below the channels
- Color-coded error tags with strikethrough for removed tags
- Keyboard accessible

#### Example

```mdx
<TypeChannelTracer
  title="Error narrowing pipeline"
  steps={[
    { op: "fetchUser(id)", a: "User", e: "NotFoundError | NetworkError | ParseError" },
    { op: "Effect.map(user => user.name)", a: "string", e: "NotFoundError | NetworkError | ParseError", note: "Success type narrows from User object to string" },
    { op: "catchTag('NotFoundError', ...)", a: "string", e: "NetworkError | ParseError", removed: ["NotFoundError"] },
    { op: "catchTags({...})", a: "string", e: "never", removed: ["NetworkError", "ParseError"] },
    { op: "Effect.runPromise", a: "string", e: "never", note: "E is never — safe to run without unhandled errors" },
  ]}
/>
```

#### Target notes

| Note | Pipeline | Tracked channel |
|------|---------|-----------------|
| `effect-ts/typed-errors` | Full error handling | `E` narrows via catchTag |
| `effect-ts/composition` | gen unions errors | `E` widens via yield* |
| `effect-ts/fault-tolerant-ingestion` | Multi-step error recovery | `E` narrows + re-types |
| `effect-ts/layers-and-di` | Layer provision | `R` narrows via provide |

---

### ParameterPlayground

Interactive parameter explorer. The reader adjusts sliders/inputs and sees computed outputs update live.

**When to use:** Algorithm pages where tuning parameters (virtual nodes, window sizes, capacities) reveals performance tradeoffs.

**When NOT to use:** Non-numeric concepts. Pages where a static table is sufficient.

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `params` | `Param[]` | yes | — | Adjustable input parameters |
| `compute` | `string` | yes | — | JS function body receiving `params` object, returns output object |
| `outputs` | `Output[]` | yes | — | Output display definitions |
| `title` | `string` | no | — | Optional header title |

```typescript
interface Param {
  name: string;
  label: string;
  type: "range" | "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  default: number | string;
  options?: { label: string; value: string | number }[];
  suffix?: string;
}

interface Output {
  name: string;
  label: string;
  format?: "percent" | "number" | "decimal" | "text";
  good?: "high" | "low";  // Color coding: green when good, red when bad
}
```

#### Example

```mdx
<ParameterPlayground
  title="VNode Balance Explorer"
  params={[
    { name: "servers", label: "Physical servers", type: "range", min: 2, max: 20, default: 5 },
    { name: "vnodes", label: "VNodes per server", type: "range", min: 1, max: 300, default: 100 },
  ]}
  outputs={[
    { name: "total", label: "Ring positions", format: "number" },
    { name: "deviation", label: "Max deviation", format: "percent", good: "low" },
  ]}
  compute={`
    var total = params.servers * params.vnodes;
    var deviation = 1 / Math.sqrt(params.vnodes);
    return { total: total, deviation: deviation };
  `}
/>
```

#### Target notes

| Note | Parameters |
|------|------------|
| `system-design/consistent-hashing` | virtualNodes, serverCount, keys |
| `system-design/rate-limiting` | windowSize, maxRequests, burstFactor |

---

### DecisionGuide

Interactive decision tree. The reader answers questions step by step and follows a guided path to a recommendation.

**When to use:** Pages that compare multiple approaches where the right choice depends on context ("catchTag vs mapError vs catchAll?").

**When NOT to use:** Binary choices that fit in a single sentence.

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `steps` | `Step[]` | yes | — | Decision nodes (questions) and result nodes |
| `title` | `string` | no | — | Optional header title |

```typescript
// Question node
interface DecisionStep {
  id: string;
  question: string;
  note?: string;
  options: { label: string; next: string }[];
}

// Result node (terminal — no options)
interface ResultStep {
  id: string;
  result: string;
  explanation: string;
  link?: string;
}
```

#### Features

- One question at a time with crossfade transitions
- Breadcrumb trail of choices (clickable to go back)
- Result card with green checkmark + recommendation
- "Start over" reset button

#### Example

```mdx
<DecisionGuide
  title="Pick the right error handler"
  steps={[
    { id: "start", question: "Do you need to handle a specific error tag?", options: [
      { label: "Yes, one specific tag", next: "r-catchTag" },
      { label: "All errors", next: "r-catchAll" },
    ]},
    { id: "r-catchTag", result: "catchTag", explanation: "Matches a single _tag and removes it from E." },
    { id: "r-catchAll", result: "catchAll", explanation: "Handles every expected error in E." },
  ]}
/>
```

#### Target notes

| Note | Decision |
|------|----------|
| `effect-ts/typed-errors` | catchTag vs mapError vs catchAll |
| `effect-ts/composition` | pipe vs gen vs fn |
| `system-design/rate-limiting` | Token Bucket vs Leaky vs Sliding |
| `system-design/message-queues` | Broker vs Stream |

---

### FiberTimeline

Horizontal swimlane diagram for concurrent/parallel execution. Each fiber/actor is a lane with colored segments showing state (active/blocked/idle). Cross-lane arrows show events like fork, join, and return.

Segments with `tip` get a **callout legend** below the chart. Hover any callout → its segment highlights and all others dim. Hover a segment → its callout highlights. This cross-highlighting replaces numbering (sequential numbers fight the concurrency concept).

**When to use:** Concepts involving parallel execution where blocking/waiting is the key insight (fiber fork/join, producer/consumer backpressure, bounded concurrency).

**When NOT to use:** Sequential message passing between separate services (use FlowSimulator). Single-actor pipelines (use PipelineStrip).

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `lanes` | `Lane[]` | yes | — | Fibers/actors, each a horizontal row |
| `segments` | `Segment[]` | yes | — | Colored blocks within lanes showing state over time |
| `events` | `TimelineEvent[]` | no | `[]` | Arrows connecting lanes at specific time points |
| `steps` | `number` | yes | — | Total number of time units (determines grid columns) |
| `title` | `string` | no | — | Optional heading |

```typescript
interface Lane {
  id: string;
  label: string;
  color?: string;  // Accent color for the lane dot
}

interface Segment {
  lane: string;    // Lane id
  start: number;   // Time unit start (0-based)
  end: number;     // Time unit end (inclusive)
  state: 'active' | 'blocked' | 'idle';
  label: string;   // Short scan-label (NOT full explanation)
  tip?: string;    // If present, segment appears in callout legend below chart
}

interface TimelineEvent {
  time: number;    // Time unit
  from: string;    // Lane id
  to: string;      // Lane id
  label: string;   // e.g. "fork", "frees slot", "returns 42"
}
```

#### Segment states

| State | Visual | Meaning |
|-------|--------|--------|
| `active` | Solid green | Fiber is executing code |
| `blocked` | Striped amber | Fiber is waiting (join, sleep, buffer full) |
| `idle` | Dotted gray | Fiber hasn't started or has finished |

#### Callout legend

Only segments with `tip` appear in the legend. Use tips for **key moments only** — fork, blocking, resume — not every segment. Self-evident segments (start, process, return) don't need tips.

#### Interaction

Cross-highlighting: hover a callout → its segment glows, all others dim. Hover a linked segment → its callout highlights. No play controls, no stepping — the reader sees everything at a glance.

#### Accuracy review checklist (MANDATORY)

Before committing any FiberTimeline, walk through this checklist:

1. **Trace the code line by line.** For each line in the code example above the diagram, identify which segment represents it. Every significant code line should map to a segment.
2. **Verify blocked durations.** For each `blocked` segment, ask: "What unblocks this?" Verify the unblocking event happens at the right time. A consumer pull frees a slot **immediately** — the producer should resume on the next tick, not stay blocked for multiple time units.
3. **Check causal order.** If segment A causes segment B, A must start at the same time or before B. Example: a child fiber must `return` before the parent can `resume`.
4. **Equal-width principle.** Each time unit should represent roughly the same granularity. Don't combine "emit 1, 2" into one wide segment when other operations get one column each — split them.
5. **Verify events.** Each arrow (`events`) must connect the correct lanes at the correct time. The label must match what actually flows between the fibers.
6. **Read the callout tips.** Each tip must accurately describe what the code does at that point. Don't paraphrase — reference the actual API calls (e.g., "Fiber.join(fiber)" not just "waits").

#### Target notes

| Note | What it shows |
|------|---------------|
| `effect-ts/concurrency` | Fork → parallel work → blocked join → resume |
| `effect-ts/streams` | Producer/Consumer backpressure — bounded buffer suspend/resume cycle |

---

### FlowSimulator

Animated message/data flow between nodes. Dots move along edges between labeled nodes. Multiple flows (e.g., happy path vs compensation) selectable via tabs.

**When to use:** Architecture pages where understanding message flow order is critical (sagas, pub/sub patterns).

**When NOT to use:** Static architectures without temporal flow. Simple request-response. **Parallel execution with blocking (use FiberTimeline instead).**

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `nodes` | `Node[]` | yes | — | System nodes (services, queues) |
| `flows` | `Flow[]` | yes | — | Named sequences of hops |
| `speed` | `number` | no | `800` | Milliseconds per hop |
| `title` | `string` | no | — | Optional header title |

```typescript
interface Node {
  id: string;
  label: string;
}

interface Flow {
  label: string;
  steps: { from: string; to: string; message: string }[];
}
```

#### Controls

| Control | Action |
|---------|--------|
| `← / →` buttons | Previous / next step |
| `▶` button | Auto-play |
| Flow tabs | Switch between scenarios |
| Arrow keys + Space | Keyboard navigation |

#### Target notes

| Note | Flow |
|------|------|
| `system-design/distributed-transactions` | Choreography happy path + compensation |
| `system-design/message-queues` | P2P vs Pub/Sub |

---

### ArchitectureExplorer

Stacked horizontal layers representing an architecture. Click any layer to expand and see its description + sub-items. Other layers dim for focus.

**When to use:** Multi-layer architectures where each layer has distinct responsibilities (request pipeline, cloud stacks).

**When NOT to use:** Flat architectures with no layering. Single-component systems.

#### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `layers` | `Layer[]` | yes | — | Ordered from bottom (infra) to top (app) |
| `title` | `string` | no | — | Optional header title |

```typescript
interface Layer {
  id: string;
  label: string;
  color?: string;       // Accent color for the left border and items
  description: string;  // Shown when expanded
  items?: string[];     // Sub-components within this layer
}
```

#### Features

- Click to expand/collapse with smooth animation
- Non-focused layers dim for visual focus
- Colored left border per layer
- Tagged sub-items within each layer
- Keyboard navigation (↑/↓ arrows, Escape)

#### Target notes

| Note | Layers |
|------|--------|
| `nestjs/fundamentals/request-lifecycle` | Middleware → Guards → Interceptors → Pipes → Handler → Filters |

---

## Future: LinkedDiagram (deferred)

Hover on a diagram node → code highlights; hover on code → diagram node highlights. Deferred due to mermaid SVG ID fragility across versions.

## Deployment rules

When deploying an interactive component to an MDX page, follow these rules:

### Placement

| Component | Where to place | Why |
|-----------|---------------|-----|
| **PipelineStrip** | After the prose summary of the pipeline | The reader gets the text-first overview, then the visual diagram reinforces it |
| **StackDiagram** | After the prose mentions wrapping or FILO order | The reader needs to know the layers exist before seeing them nested |
| **CodeWalkthrough** | Wrap the existing code block in-place | Same — the code block stays put |
| **TypeChannelTracer** | **After** the section that explains the concepts it references | The reader must already understand the operations (pipe, gen, catchTag) before seeing how they affect the type channels |
| **DecisionGuide** | After the reference table or comparison section | The reader needs the raw facts before they're ready for a decision tree |
| **FlowSimulator** | After the first prose explanation of the flow | The prose sets the context; the simulator lets the reader replay it |
| **FiberTimeline** | After the code example showing the concurrent pattern | The reader must see the code first, then the timeline reveals what's happening in parallel |
| **ArchitectureExplorer** | After the pipeline/architecture section header | Layer-by-layer exploration replaces or supplements a static diagram |
| **ParameterPlayground** | After the algorithm explanation, before or after the code | The reader must understand what the parameters mean before tuning them |

### CodeWalkthrough line numbers

`lines` values reference lines **within the wrapped code block**, not the MDX file. Count from line 1 = first line after the opening ` ``` ` fence.

**Common mistakes:**
- Off-by-one from JSDoc `*/` closers or `@param` tags
- Starting a step on a blank line between code sections
- Ending a step before the closing `}` of a block

**Automated check:** `bun run lint:interactive-components` catches only definitive errors (zero false positives):
- Steps starting or ending on blank lines
- Line ranges pointing outside the code block
- Start line greater than end line

**What it does NOT catch** (requires visual check on dev server):
- Off-by-one where both lines have valid code (e.g., `*/` vs the actual method signature)
- Steps highlighting JSDoc when they should highlight the code below it
- Step body/note text that references the wrong composition style

### TypeChannelTracer note accuracy

The `note` text on each step must match the actual code. Common mistake: saying "gen unions it" when the code uses `pipe`/`flatMap`. Before writing notes:
1. Read the actual code block the tracer describes
2. Verify which composition style each step uses
3. Match the vocabulary to the code (flatMap ≠ gen ≠ pipe)

### Content text guidelines

All `body`, `label`, `note`, `explanation`, and `description` text in component props must:
- **Not assume prior knowledge** — if a step mentions "FILO" or "catchTag", explain what it means in the same sentence
- **Reference the page content** — use the same terminology and examples as the surrounding prose
- **Be self-contained** — a reader who only reads the interactive component (ignoring the rest of the page) should still learn something

## Technical details

- **Progressive enhancement:** All components render full content without JS.
- **Scripts:** Re-init on `astro:page-load` for Starlight view transitions.
- **Styling:** Scoped styles mapping from `--sl-color-*` Starlight variables.
- **Print:** Controls hidden, all content visible at full opacity.
- **Responsive:** Container queries adapt to narrow viewports.

