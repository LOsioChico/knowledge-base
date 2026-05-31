# SkillOpt: Session Context Hygiene & Self-Evolution

> Extracted from AGENTS.md. For the universal invariants, see [AGENTS.md](../AGENTS.md).

## Session context hygiene & SkillOpt self-evolution

For substantial new features, deep refactors, or brand new architectural guides (such as introducing a new AWS service index or a multi-file recipe):
- **Prefer starting a fresh, clean chat session** rather than continuing a long, high-token thread. This maintains maximum reasoning precision, keeps generation speeds high, and avoids context-bloat pollution from prior tasks.
- **Initiate the new session with an explicit bootstrap prompt** specifying the target scope and SDD configurations (Execution Mode: `interactive` vs `auto`, Artifact Store: `openspec`, and Delivery Strategy: `ask-on-risk`).

This ensures high precision, clean git branches, and structured planning history.

### Text-space skill self-evolution (SkillOpt v2)
To keep the agent's procedural memory sharp and immune to repeated gotchas, we employ a **SkillOpt text-space self-evolution loop**:
- At the end of every pair-programming session, run `bun run skills:opt` to trigger the optimizer model.
- The optimizer analyzes the active session's transcript logs, extracts lessons (bugs, gotchas, conventions, patterns), and generates micro-rule proposals for the `.github/skills/` folder.
- These micro-rules are automatically validated against quality gates (`bun run lint:wikilinks` and `astro check`) before being applied to disk. A deduplication guard prevents adding rules that already exist (≥80% key-phrase overlap).
- Evolved skills are then committed directly to the repository as part of standard session work.

**CLI flags:**

| Flag | Example | Behavior |
| --- | --- | --- |
| *(none)* | `bun run skills:opt` | Optimizes `kb-author/SKILL.md` (default) |
| `--target <name>` | `bun run skills:opt -- --target kb-enrichment` | Resolves short name → `.github/skills/<name>/SKILL.md` |
| `--target <path>` | `bun run skills:opt -- --target AGENTS.md` | Uses literal path |
| `--auto` | `bun run skills:opt -- --auto` | Detects which skills were loaded during the session and optimizes each |
| `--dry-run` | `bun run skills:opt -- --dry-run` | Preview proposals without writing to disk |
| `--conversation-id <id>` | `bun run skills:opt -- --conversation-id abc123` | Optimize a specific session (default: most recent) |
