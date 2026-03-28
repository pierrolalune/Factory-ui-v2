# Harness Complexity Audit Workflow

On-demand diagnostic workflow that evaluates whether each component of the autonomous-factory is still load-bearing. Run after model upgrades to identify scaffolding that may have become redundant as model capabilities improve.

## Phase 1: Inventory

Read every file in these directories and produce a complete inventory:
- `.claude/agents/*.md` — all agent persona files
- `.claude/skills/*.md` — all skill files
- `.claude/skills/workflows/*.md` — all workflow files
- `.claude/commands/*.md` — all command files

## Phase 2: Classification

For each component in the inventory, classify it:

## Phase 3: Dependency Analysis

Analyze the dependency graph:
1. Which components are referenced by multiple workflows? (high connectivity = higher risk to remove)
2. Which components are only referenced by one workflow? (low connectivity = safer to evaluate)
3. Are there component clusters that could be merged? (e.g., multiple agents with overlapping responsibilities)
4. Are there orphaned components? (defined but never referenced by any workflow or command)

## Phase 4: Simplification Report

Produce the final report at `Docs/reports/harness-audit-{YYYY-MM-DD}.md`:

## Phase 5: Incremental Removal Testing

**Trigger**: Only runs if the user explicitly requests it after reviewing the Phase 4 report. This phase makes temporary changes — it requires human approval.

**Article quote**: "I moved to a more methodical approach, removing one component at a time and reviewing what impact it had on the final result."

**Agent**: dev (subagent_type: "dev")

**Process**: For each component classified as REDUNDANT (lowest connectivity first):

1. **Disable**: Temporarily rename the component file (e.g., `qa-agent.md` → `qa-agent.md.disabled`)
2. **Test**: Run a small, representative feature through the pipeline (use a test seed in `factory-seeds.md`)
3. **Compare**: Evaluate the output quality with and without the component:
   - Did any phase fail or produce worse output?
   - Did the Final User score change?
   - Did the pipeline behave differently?
4. **Record**: Log the result:
   ```
   Component: {name}
   Classification: REDUNDANT
   Test result: CONFIRMED REDUNDANT | ACTUALLY REINFORCING | ACTUALLY LOAD-BEARING
   Evidence: {what changed or didn't change}
   ```
5. **Restore**: Re-enable the component (rename back) before testing the next one
6. **Human checkpoint**: After each component test, present the result and ask: proceed to next, or stop?

**Reclassification**: If removing a REDUNDANT component degrades output, reclassify it as REINFORCING in the report. If it degrades output significantly, reclassify as LOAD-BEARING.

**Output**: Updated report with empirically validated classifications.

**Gate**: Human approval between each removal test. Never test more than one removal at a time.

---

## Important Notes

- Phases 1-4 are diagnostic only — they do NOT modify or delete any components
- Phase 5 makes temporary changes but always restores them — requires explicit user request
- All recommendations require human review before permanent action
- Run this after major model upgrades (e.g., Claude Opus 4.6 → next version)
- Compare reports across model versions to track which assumptions went stale
- The article warns: "Don't overcorrect — remove components incrementally"