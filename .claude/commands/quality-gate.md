# Quality Gate

---

## Command

```
---
name: quality-gate
description: Run a pre-merge quality check — code review + QA testing + design audit (report-only)
---

Run the Quality Gate workflow defined in `.claude/skills/workflows/quality-gate-workflow.md`.

Follow every phase in order, respecting gates and agent personas. Use the full workflow instructions — do not skip or summarize phases.

**Use this for**: Pre-merge quality checks on feature branches. Unlike `/review` (which focuses on code review), this runs a full quality gate including code review, QA testing, and design audit.

Input (optional branch name or PR number):
$ARGUMENTS

```

## Arguments

- `{ARGUMENTS}`: optional branch name or PR number