# Audit Harness

---

## Command

```
---
name: audit-harness
description: Run the Harness Complexity Audit
---

Run the Harness Complexity Audit workflow (`.claude/skills/workflows/harness-audit-workflow.md`).

Inventories every agent, skill, and workflow in the autonomous-factory. For each component, identifies the model-limitation assumption it encodes and classifies it as LOAD-BEARING, REINFORCING, REDUNDANT, or COUNTERPRODUCTIVE.

Produces a report with simplification recommendations. Run after model upgrades to identify scaffolding that's no longer needed.

**This is a diagnostic tool** — it does NOT automatically remove components. It produces information for a human decision.

Usage: `/audit-harness`

```

## Arguments

- `{ARGUMENTS}`: Input for the command