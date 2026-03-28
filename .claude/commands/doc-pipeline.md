# Doc Pipeline

---

## Command

```
---
name: doc-pipeline
description: Generate comprehensive documentation
---

Run the Documentation Pipeline workflow defined in `.claude/skills/workflows/documentation-pipeline-workflow.md`.

Follow every phase in order, respecting gates and agent personas. Use the full workflow instructions — do not skip or summarize phases.

Input (documentation scope or path to a file describing what to document):
$ARGUMENTS

```

## Arguments

- `{ARGUMENTS}`: documentation scope or path to a file describing what to document