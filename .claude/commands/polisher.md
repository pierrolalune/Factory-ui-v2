# Polisher

---

## Command

```
---
name: polisher
description: Run continuous codebase quality improvement
---

Run the Code Polisher workflow defined in `.claude/skills/workflows/code-polisher-workflow.md`.

This workflow runs in its own worktree for full isolation. It uses Ralph Loop for continuous, autonomous execution — it will never stop on its own.

Follow every phase in order, respecting all gates, agent personas, and veto rules. Use the full workflow instructions — do not skip or summarize phases.

**Autonomous mode**: No human checkpoints. The Final User Agent is the quality gate that scores every file group after polishing.

**On any failure**: Skip the current file group, log the reason, and move to the next one in the queue. Never halt the pipeline.

Input (optional file path or module to prioritize in the polish queue):
$ARGUMENTS

```

## Arguments

- `{ARGUMENTS}`: optional file path or module to prioritize in the polish queue