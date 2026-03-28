# Improve Loop

---

## Command

```
---
name: improve-loop
description: Run iterative improvement cycles on the codebase
---

Run the Improve Loop workflow defined in `.claude/skills/workflows/improve-loop-workflow.md`.

This is an iterative feature improvement meta-workflow. It takes an existing feature, analyzes it from rotating expert angles, generates substantial improvement seeds, delegates to the full /factory pipeline, then repeats N times. Each cycle builds on the previous — the feature gets progressively better.

This workflow runs in its own worktree for full isolation. It uses a bounded Ralph Loop — it stops after N cycles (default 5).

Follow every phase in order, respecting all gates, agent personas, and veto rules. Use the full workflow instructions — do not skip or summarize phases.

## How It Works

1. Parse $ARGUMENTS: first quoted string = feature to improve, optional trailing integer = cycle count (default 5)
2. Each cycle: agents analyze the feature from a rotating angle, propose improvements, CEO filters them, seeds are written to factory-seeds.md
3. The full /factory pipeline runs on those seeds (spec, TDD, review, ship — the whole thing)
4. After factory finishes, write a retrospective, save state to JSON, run /clear
5. Next cycle starts fresh from the state file with a new angle

## Rotating Angles (one per cycle)

- Cycle 1: Customer Experience (Final User + Business Analyst) — what's frustrating, confusing, or missing?
- Cycle 2: Feature Depth (Architect + Business Analyst) — what's V1 but should be V2?
- Cycle 3: Visual & Interaction Polish (UX Designer + Lead Dev) — states, responsive, microcopy, consistency
- Cycle 4: Workflow Integration (Product Manager + Architect) — navigation, cross-feature links, discoverability
- Cycle 5: Edge Cases & Robustness (QA + Lead Dev) — 0 items, 1000 items, errors, rapid clicks

## State Persistence & Context Management

State is saved to `.claude/state/improve-loop-state.json` at the end of every cycle.
Context reset is conditional: `/clear` runs only if the session has been active >= 90 minutes (Opus 4.6 sustains coherence for 2+ hours). For shorter sessions, context is preserved between cycles for richer cross-cycle continuity. The state file is always written regardless as a crash-recovery safety net.
On resume (after /clear or continuation), read the state file to know which cycle you're on and what angle is next.

**Autonomous mode**: All human checkpoints are replaced by agent proxies. The CEO-Founder filters seeds (HOLD SCOPE — no scope expansion). The Final User Agent evaluates improvements after factory ships them.

**On any failure**: Log the reason, save state, /clear, and continue to the next cycle. Never halt unexpectedly.

Input (required: feature to improve; optional: cycle count):
$ARGUMENTS

Examples:
  /improve-loop "the Grader page"
  /improve-loop "the Grader page" 3
  /improve-loop "Run History and filtering" 7
```

## Arguments

- `{ARGUMENTS}`: required: feature to improve; optional: cycle count
