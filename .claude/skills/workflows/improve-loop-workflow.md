# Improve Loop Workflow

Iterative feature improvement meta-workflow. Takes an existing feature, analyzes it from rotating expert angles, generates substantial improvement seeds, delegates to the full `/factory` pipeline, then repeats. Each cycle builds on the previous — the feature gets progressively better.

## Phase 1: Init / Resume

**Runs at the start of every cycle.** Read `.claude/state/improve-loop-state.json`.

### First Run (state file does not exist or `status` is `completed`/`stalled`)

1. Parse `$ARGUMENTS`:
   - First argument (quoted string): the feature/area to improve (e.g., `"the Grader page"`)
   - Second argument (optional integer): number of cycles (default: 5)
2. **Feature reconnaissance** — scan the codebase to build the "feature manifest":
   - Search for files matching the feature name in `frontend/src/components/`, `frontend/src/app/`, `frontend/src/hooks/`, `frontend/src/lib/schemas/`, `backend/routers/`, `backend/services/`
   - Include related test files, docs, and specs
   - List all routes, API endpoints, and components belonging to this feature
3. Write initial state to `.claude/state/improve-loop-state.json`:
   ```json
   {
     "pipeline": "improve-loop",
     "status": "running",
     "target_feature": "the Grader page",
     "max_cycles": 5,
     "current_cycle": 1,
     "feature_manifest": ["file1.tsx", "file2.py", "..."],
     "cycles": [],
     "metrics": { "total_shipped": 0, "total_skipped": 0, "avg_score": 0 },
     "phase_timings": {
       "discovery_avg_seconds": 0,
       "ceo_endorsement_avg_seconds": 0,
       "factory_delegation_avg_seconds": 0,
       "retrospective_avg_seconds": 0,
       "total_cycle_avg_seconds": 0,
       "bottleneck_phase": null
     }
   }
   ```
4. Proceed to Phase 1.

### Resume (state exists and `status` is `running`)

1. Read state — determine `current_cycle` and compute the next angle
2. **Loop decision**:
   - If `current_cycle > max_cycles`: write final summary to `Docs/reports/IL-final-{feature-slug}.md`, set `status: "completed"`, STOP
   - If the last 2 consecutive cycles both had 0 shipped seeds: set `status: "stalled"`, write summary, STOP
   - Otherwise: proceed to Phase 1 with the next angle

**Gate**: always.

---

## Phase 2: Angle-Focused Discovery

The heart of the workflow. Each cycle uses one of 5 rotating expert angles. Assignment: `angle_index = (current_cycle - 1) % 5`.

### Angle Rotation Table

| Cycles | Angle | Lead Agent | Support Agent | Tag |
|--------|-------|------------|---------------|-----|
| 1, 6, 11... | Customer Experience | final-user | business-analyst | CX |
| 2, 7, 12... | Feature Depth | architect | business-analyst | FD |
| 3, 8, 13... | Visual & Interaction Polish | ux-designer | lead-dev | VP |
| 4, 9, 14... | Workflow Integration | product-manager | architect | WI |
| 5, 10, 15... | Edge Cases & Robustness | qa | lead-dev | EC |

### Angle 1: Customer Experience (CX)

**Lead**: final-user (subagent_type: "final-user")
**Support**: business-analyst (subagent_type: "business-analyst")

**Final User task**:
**Use the browser to experience the feature as a real user.** Do NOT just read code — actively test:
- Launch the dev server if not running
- `browser_navigate` to the feature's main entry point
- Walk through the feature via `browser_click`, `browser_fill_form`, `browser_snapshot`
- `browser_take_screenshot` at every significant state to capture evidence
- `browser_resize` to 375px (mobile) and 1280px (desktop) to check responsiveness
- `browser_console_messages` to catch JS errors

For each flow, answer (based on what you SAW in the browser, not what you read in code):
- What is the happy path? Does it work smoothly end-to-end?
- What happens on first use with no data? Is there guidance or a void?
- What happens when something fails? Helpful message or silent death?
- What is confusing about the flow? Where would I get stuck?
- What would I expect to be able to do that I cannot?
- What feels janky, slow, or unfinished?

Write a **Customer Critique Report** — numbered items, each a real user pain point with screenshot evidence. Think like someone who just opened the app and is trying to get work done.

**Business Analyst task**:
For each pain point, write a concrete improvement proposal:
- What should change?
- Why does it matter to the user?
- What is the expected outcome?

Filter out anything trivial — each proposal must meaningfully change the user experience.

**Output**: 3-8 improvement seeds.

### Angle 2: Feature Depth (FD)

**Lead**: architect (subagent_type: "architect")
**Support**: business-analyst (subagent_type: "business-analyst")

**Architect task**:
Read every file in the feature manifest. Map the data flow from API to UI. Identify:
- API endpoints that return data the frontend does not use
- Capabilities the data model supports but the UI does not expose
- Places where the feature does the simple case but not the complex case (single but not batch, create but not import/export, view but not filter/sort/search)
- Missing configuration or customization that power users would want
- Patterns that are "V1 but should be V2"

For each gap, propose a concrete V2 capability.

**Business Analyst task**:
For each V2 capability, write a user story: As a [power user], I want [capability] so that [outcome]. Filter out pure architectural cleanup — focus on user-facing depth.

**Output**: 3-8 improvement seeds.

### Angle 3: Visual & Interaction Polish (VP)

**Lead**: ux-designer (subagent_type: "ux-designer")
**Support**: lead-dev (subagent_type: "lead-dev")

**UX Designer task**:
**Use the browser to inspect the feature visually.** Do NOT just read component code — experience it:
- Launch the dev server if not running
- `browser_navigate` to each page/view in the feature manifest
- `browser_take_screenshot` at each view as baseline evidence
- `browser_resize` to 375px, 768px, and 1280px — screenshot each
- `browser_press_key` Tab repeatedly to test keyboard navigation
- `browser_snapshot` to inspect the accessibility tree (ARIA labels, heading hierarchy, landmarks)

For each component in the feature manifest, evaluate (based on what you SEE):
- **States**: Does loading show skeleton/spinner? Does error show helpful message with retry? Does empty show friendly guide with action?
- **Responsive**: Does it work at 375px (mobile), 768px (tablet), 1280px (desktop)? Screenshot evidence for each.
- **Keyboard**: Can you Tab through everything? Do modals trap focus? Escape to close?
- **Visual consistency**: Spacing, colors, typography from design tokens? Matches rest of app?
- **Interaction feedback**: Hover/active states on buttons? Disabled state on submit? Confirmation on destructive actions?
- **Microcopy**: Labels specific? Error messages actionable? Button text says what it does?

Group findings into themed improvements — not individual bug reports.

**Lead Dev task**:
Filter out trivial fixes (< 10 min). Combine related issues into substantial themed seeds. Each seed should touch multiple related aspects.

**Output**: 3-6 improvement seeds.

### Angle 4: Workflow Integration (WI)

**Lead**: product-manager (subagent_type: "product-manager")
**Support**: architect (subagent_type: "architect")

**Product Manager task**:
- How does the user discover this feature? Sidebar link? Breadcrumbs? Related feature links?
- Does this feature link to related features where appropriate? (e.g., from a run result, can you jump to the project?)
- Does data flow naturally between features? (e.g., if grader scores a run, does run history show that score?)
- Is there useful context from other features this one should display?
- Are there batch operations or cross-feature actions that would save time?
- Does the feature respect navigation patterns (breadcrumbs, back buttons, deep links, URL state)?

**Architect task**:
For each integration gap, assess feasibility: Is the data already available via existing APIs? What new endpoints or props are needed? Rate effort (low/medium/high). Filter out anything requiring architectural overhaul.

**Output**: 3-6 improvement seeds.

### Angle 5: Edge Cases & Robustness (EC)

**Lead**: qa (subagent_type: "qa-tester")
**Support**: lead-dev (subagent_type: "lead-dev")

**QA task**:
For each user flow in the feature:
- **0 items**: Empty state or broken layout?
- **1000+ items**: Pagination, virtualization, or performance collapse?
- **API 500**: Helpful error or white screen?
- **Rapid clicks**: Debounced/disabled, or duplicate submissions?
- **Navigate away during async**: Graceful or crash?
- **Long text inputs**: Handled or overflow?
- **Missing/malformed data**: Validated or exception?

Group into improvement themes — each theme addresses a class of edge cases.

**Lead Dev task**:
Prioritize by real-world likelihood. Combine related edge cases into substantial seeds that add a complete layer of defensive handling.

**Output**: 3-6 improvement seeds.

### Quality Bar (all angles)

Every seed must:
- Describe a **user-visible change** (not internal refactoring)
- Take at least **20+ minutes** of focused development (not a one-liner)
- Be something a user would **notice and appreciate**

Good: "Add a diff viewer with syntax highlighting to the optimizer results"
Bad: "Fix button color" or "Rename variable"

**Gate**: >= 2 seeds produced. If < 2 after 2 retries with explicit instruction to look harder, skip this cycle (advance to Phase 5 directly).

---

## Phase 3: CEO Endorsement & Prioritization

**Agent**: ceo-founder (subagent_type: "ceo-founder") in **HOLD SCOPE** mode

The CEO does NOT add ideas. The CEO filters and prioritizes:

1. Read all proposed seeds from Phase 1
2. For each seed, evaluate:
   - **Substantial enough?** Would it take > 20 min to implement?
   - **Interesting enough?** Would a user notice and appreciate this?
   - **Achievable?** Can the factory pipeline implement this in one factory run?
   - **Novel?** Does it overlap with something already shipped in a previous cycle? (Check `improve-loop-state.json` cycles history)
3. For each seed: **APPROVE**, **MERGE** (combine two similar seeds into one), or **REJECT** (with reason)
4. Order approved seeds from most impactful to least impactful
5. **Cap at 5 seeds per cycle** — if more than 5 approved, pick the top 5

**Output**: Final ordered list of 2-5 approved seeds.

**Gate**: >= 1 seed approved. If CEO rejects all, log rejection reasons in state, advance to Phase 5 (skip this cycle's factory run).

---

## Phase 4: Seed File Write

1. Read `.claude/state/factory-seeds.md`
2. Preserve all existing `[DONE]` and `[SKIPPED]` lines
3. Append approved seeds as new tagged lines:
   ```
   - [IL-C{N}-{TAG}] {seed description}
   ```
   Examples:
   ```
   - [IL-C1-CX] Add empty state with onboarding guide to the Grader suites tab when no suites exist
   - [IL-C1-CX] Add inline error recovery with retry button when grader API calls fail
   - [IL-C2-FD] Add search and filter to the test suites list for power users with many suites
   ```
4. Update `improve-loop-state.json`: record seeds written for this cycle

**Gate**: always.

---

## Phase 5: Factory Delegation

**This phase delegates to the full `/factory` pipeline.** The improve-loop does NOT re-implement factory.

1. Execute the Feature Factory workflow (`.claude/skills/workflows/feature-factory-workflow.md`)
2. Factory will:
   - Ingest the new `[IL-C{N}]` seed lines in its Phase 0
   - Skip autonomous discovery (user seeds exist — `wsjf_score: 999`)
   - Run the full inner pipeline for each seed: spec → arch → TDD → review → docs → UX polish → Final User → ship
   - Mark each seed as `[DONE]` or `[SKIPPED: reason]` in `factory-seeds.md`
3. **Completion detection**: After factory processes a seed, check `factory-seeds.md`. When every line tagged `[IL-C{N}]` (current cycle number) is either `[DONE]` or `[SKIPPED]`, this phase is complete.

**Gate**: All seeds for this cycle resolved (shipped or skipped).

---

## Phase 6: Cycle Retrospective + /clear

**Agent**: product-manager (subagent_type: "product-manager")

### Retrospective

1. Read `factory-seeds.md` — count shipped vs. skipped for this cycle's `[IL-C{N}]` tags
2. Read Final User reports from `Docs/reports/` for any shipped seeds
3. Write a **Cycle Retrospective** to `Docs/reports/IL-C{N}-{feature-slug}-retro.md`:

```markdown
# Improve Loop — Cycle {N} Retrospective

**Feature**: {target_feature}
**Angle**: {angle_name} ({TAG})
**Lead Agent**: {lead_agent} + {support_agent}
**Date**: YYYY-MM-DD

## Results

| Metric | Value |
|--------|-------|
| Seeds proposed | X |
| Seeds approved (CEO) | X |
| Seeds shipped | X |
| Seeds skipped | X |
| Avg Final User score | XX/100 |
| Cycle duration | X min |
| Discovery phase | X min |
| CEO endorsement | X min |
| Factory delegation | X min |
| Bottleneck | {phase_name} |

## Shipped

1. **[IL-C{N}-{TAG}] {seed}** — Final User score: XX/100
2. ...

## Skipped

1. **[IL-C{N}-{TAG}] {seed}** — Reason: {skip_reason}
2. ...

## Next Cycle

- Cycle {N+1} of {max_cycles}
- Next angle: {next_angle_name} ({next_tag})
- Lead: {next_lead_agent} + {next_support_agent}
```

### State Update

Update `improve-loop-state.json`:
- Append this cycle's results to `cycles[]`
- Increment `current_cycle`
- Update `metrics` (total_shipped, total_skipped, avg_score)

### If this is the final cycle

Write a **Final Summary** to `Docs/reports/IL-final-{feature-slug}.md`:
- All cycles summarized
- Total seeds shipped / skipped across all cycles
- Overall average Final User score
- The feature's improvement journey: what it was before, what it is now

Set `status: "completed"`.

### Context Reset (Conditional)

**Context management strategy** (optimized for Opus 4.6+):

- **If the session has been running for < 90 minutes** (check `started_at` from Phase 0 against current time): **skip `/clear`**. Opus 4.6 sustains coherence for 2+ hours. Keeping context between cycles allows the discovery phase to reference prior cycle findings for richer proposals. **Always write the state file** as a crash-recovery safety net.

- **If the session has been running for >= 90 minutes**: **run `/clear`** to prevent context exhaustion. The state file contains everything needed to resume.

This is conservative — the state file is always written regardless, preserving crash recovery. The optimization leverages improved model context handling to maintain cross-cycle continuity when token pressure is low.

---

## Failure Handling Summary

| Failure | Phase | Action |
|---------|-------|--------|
| Feature target not found (no matching files) | 0 | Set `status: "aborted"`, STOP |
| Discovery produces < 2 seeds after 2 retries | 1 | Skip cycle, advance to Phase 5 |
| CEO rejects all seeds | 2 | Skip cycle, advance to Phase 5 |
| Factory skips all seeds in a cycle | 4 | Log in retrospective, continue |
| 2 consecutive cycles with 0 shipped seeds | 5 | Set `status: "stalled"`, STOP early |

**On any skip**: Log the reason, write the retrospective, save state, `/clear`, and continue to the next cycle. Never halt unexpectedly.

---

## Workflow Summary

```
Phase 0  | Init / Resume from state      | (built-in)              | always
Phase 1  | Angle-Focused Discovery        | Rotating (see table)    | >= 2 seeds
Phase 2  | CEO Endorsement               | CEO-Founder (HOLD SCOPE)| >= 1 approved
Phase 3  | Seed File Write               | (built-in)              | always
Phase 4  | Factory Delegation            | Full /factory pipeline  | all cycle seeds resolved
Phase 5  | Retrospective + /clear        | Product Manager         | always
```

**Default cycles**: 5 (configurable via argument)
**Angles**: Customer Experience → Feature Depth → Visual Polish → Workflow Integration → Edge Cases (rotating)
**Seeds per cycle**: 2-5 (agents propose, CEO caps)
**Quality bar**: Every seed must be substantial, user-visible, and something a user would notice