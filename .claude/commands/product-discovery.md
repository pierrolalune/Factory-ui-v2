# Product Discovery

---

## Command

```
---
name: product-discovery
description: Run product discovery to surface new feature opportunities from market and user analysis
---

Run the Product Discovery workflow defined in `.claude/skills/workflows/product-discovery-workflow-new-features-only.md`.

Follow every phase in order, respecting gates and agent personas. Use the full workflow instructions — do not skip or summarize phases.

**Note**: This focuses on product/market discovery for NEW features. For codebase-driven discovery (finding gaps in existing code), the Feature Factory's autonomous discovery handles that automatically.

Input (optional product area or user persona to focus discovery on):
$ARGUMENTS

```

## Arguments

- `{ARGUMENTS}`: optional product area or user persona to focus discovery on