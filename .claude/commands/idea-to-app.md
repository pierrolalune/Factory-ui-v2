# Idea To App

---

## Command

```
---
name: idea-to-app
description: Turn a brief idea into a fully running application from scratch
---

Run the Idea-to-App workflow defined in `.claude/skills/workflows/idea-to-app-workflow.md`.

This workflow takes a brief idea (1-4 sentences) and produces a fully running, tested, polished application from scratch. It orchestrates 7 phases: Product Vision, Project Scaffold, Feature Decomposition, Factory Execution, Improvement Cycles, Final Polish, and Deliverable Report.

This workflow runs in its own worktree for full isolation. It runs through 7 phases and then stops.

Follow every phase in order, respecting all gates, agent personas, and veto rules. Use the full workflow instructions — do not skip or summarize phases.

**Autonomous mode**: All human checkpoints are replaced by agent proxies (CEO-Founder for vision/scope decisions, Lead Dev for technical GO/NOGO, Final User for quality gates). Zero human intervention required.

**On any failure**: Handle per-phase failure rules in the workflow. Log the reason, save state, and either retry, skip, or abort as specified. Never halt unexpectedly.

Input (the app idea, 1-4 sentences):
$ARGUMENTS

Examples:
  /idea-to-app "Build a browser-based digital audio workstation using Web Audio API"
  /idea-to-app "Build a retro 2D game maker with sprite editor, level editor, and AI-assisted design"
  /idea-to-app "A personal finance dashboard that connects to bank APIs, categorizes transactions with AI, and shows spending insights"
  /idea-to-app "Build a simple todo app with categories, due dates, and natural language task creation"

```

## Arguments

- `{ARGUMENTS}`: the app idea, 1-4 sentences