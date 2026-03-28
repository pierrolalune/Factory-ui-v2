# Security Audit

---

## Command

```
---
name: security-audit
description: Run a comprehensive security audit
---

Run the Security Audit workflow defined in `.claude/skills/workflows/security-audit-workflow.md`.

Follow every phase in order, respecting gates and agent personas. Use the full workflow instructions — do not skip or summarize phases.

Input (target scope or path to a file describing what to audit):
$ARGUMENTS

```

## Arguments

- `{ARGUMENTS}`: target scope or path to a file describing what to audit