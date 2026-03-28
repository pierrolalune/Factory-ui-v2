# Factory

---

## Command

```
---
name: factory
description: Run the Feature Factory workflow for autonomous feature delivery
---

Run the Feature Factory workflow defined in `.claude/skills/workflows/feature-factory-workflow.md`.

This workflow runs in its own worktree for full isolation. It uses Ralph Loop for continuous, autonomous execution — it will never stop on its own.

Follow every phase in order, respecting all gates, agent personas, and veto rules. Use the full workflow instructions — do not skip or summarize phases.

## User Seeds — Your Ideas First

Before starting the loop, handle user-provided feature ideas:

1. If `$ARGUMENTS` contains feature ideas (quoted strings like `"Add dark mode" "Build CSV export"`):
   - Append each idea as a new `- ` line to `.claude/state/factory-seeds.md`
2. Read `.claude/state/factory-seeds.md` on every iteration (Phase 0)
3. **User seeds are always tackled FIRST** — before any auto-discovered features
4. Only switch to autonomous discovery after ALL user seeds are shipped or skipped
5. The user can edit `factory-seeds.md` at any time to add new ideas — they'll be picked up on the next iteration and jump to the front of the queue

**Autonomous mode**: All human checkpoints are replaced by agent proxies (CEO-Founder for vision decisions, Lead-Dev for technical GO/NOGO). The Final User Agent is the quality gate that scores every feature before shipping.

**On any failure**: Skip the current feature, log the reason, mark the seed line as `[SKIPPED: reason]`, and move to the next one. Never halt the pipeline.

Input (optional feature ideas to add to the seed file before starting):
$ARGUMENTS

```

## Arguments

- `{ARGUMENTS}`: optional feature ideas to add to the seed file before starting