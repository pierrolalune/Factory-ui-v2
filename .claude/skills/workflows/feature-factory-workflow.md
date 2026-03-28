# Feature Factory Workflow

Fully autonomous, self-looping pipeline that continuously generates, specifies, implements, and ships features — without human intervention. Chains existing workflows with autonomous decision-making at human checkpoints.

## Phase 1: User Seed Ingestion

**Runs at the start of every Ralph Loop iteration**, before checking the backlog.

1. Read `.claude/state/factory-seeds.md`
2. Parse the file line by line:
   - Lines starting with `- ` (not preceded by `[DONE]` or `[SKIPPED`) are **pending seeds**
   - Lines starting with `- [DONE]` or `- [SKIPPED` are already processed — skip them
   - Lines starting with `#` are comments — skip them
   - Blank lines — skip
3. For each pending seed, check if it's already in `.claude/state/feature-backlog.json`:
   - Match by comparing the seed text against existing `description` fields (fuzzy match — same idea worded differently should match)
   - If NOT already in backlog: create a new backlog entry:
     ```json
     {
       "id": "FP-{next available NNN}",
       "name": "{extracted feature name from the seed text}",
       "description": "{the full seed line text}",
       "wsjf_score": 999,
       "moscow": "Must",
       "source": "user",
       "seed_line": {line number in the file},
       "status": "queued",
       "skip_reason": null,
       "ceo_endorsement": "User-requested feature — top priority"
     }
     ```
4. If `$ARGUMENTS` were passed to the `/factory` command and this is the first iteration:
   - Append each argument as a new `- ` line to `factory-seeds.md`
   - Then process them as above

**User seeds always get `wsjf_score: 999`** to sort above any auto-discovered feature.
**Within user seeds, `seed_line` preserves the original order** from the file.

### Seed File Status Updates

After a feature completes (shipped or skipped), update the corresponding line in `factory-seeds.md`:
- **Shipped**: `- Add dark mode toggle` → `- [DONE] Add dark mode toggle`
- **Skipped**: `- Add webhook notifications` → `- [SKIPPED: blocked_security_veto] Add webhook notifications`

This lets the user see progress by reading the seed file.

**Gate**: always — seed ingestion is a lightweight read operation, never blocks.

---

## Phase 2: Autonomous Discovery

**Trigger**: Only runs when:
- There are **no queued user seeds** in the backlog (`source: "user"`, `status: "queued"`)
- AND the auto-discovered backlog has fewer than 3 queued features

If user seeds exist, **skip this phase entirely** — go straight to popping the next user seed.

Delegate to `.claude/skills/workflows/autonomous-discovery-workflow.md`.

This runs the full discovery pipeline:
- Architect + UX Designer + Data Analyst scan the project (parallel)
- Business Analyst discovers use cases
- Product Manager + Lead Dev ideate and assess feasibility
- CEO-Founder approves and prioritizes (replaces human review gate)
- Approved features written to `.claude/state/feature-backlog.json` with `source: "autonomous-discovery"`

**Gate**: always — backlog must have at least 1 queued feature before proceeding.

If discovery produces 0 approved features (CEO rejected all):
- Set factory status to `waiting_for_backlog`
- Write state and yield this iteration
- On next Ralph Loop tick: re-check seeds file (user may have added new ideas), then retry discovery

---

## Phase 2.5: Triage / Complexity Classification

**Runs once per feature**, immediately after popping it from the backlog and before any agent work begins.

Follow `.claude/skills/triage-router.md` to classify the feature as **PATCH**, **MINOR**, or **MAJOR**.

1. Read the feature seed text and description from the backlog entry
2. Apply classification logic (MAJOR signals first, then PATCH, default MINOR)
3. Store the tier in state: `current_feature.tier`, `current_feature.tier_rationale`
4. Route to the appropriate pipeline:

**PATCH tier** — lightweight pipeline:
- Jump directly to Phase 5 (TDD Sprint) with max 2 iterations
- Then Phase 6a (Code Review): Lead Dev + Security **in parallel**
- If Lead Dev escalates tier (`[ESCALATE: MINOR]` or `[ESCALATE: MAJOR]`): update `current_feature.tier`, set `current_feature.tier_escalated_from: "PATCH"`, and re-enter the pipeline at Phase 3 (Feature Spec)
- If both approve: jump to Phase 10 (Ship). Skip Spec, Architecture, Sprint Contract, UX Polish, Documentation, Final User.

**MINOR tier** — optimized pipeline:
- Proceed through all phases with these optimizations:
  - Skip Sprint Contract Negotiation (Dev writes Implementation Contract only, no QA/Final User contracts)
  - TDD Sprint: max 3 iterations (instead of 6)
  - Skip Phase 8 (UX Polish) if no frontend files changed
- All other phases run normally

**MAJOR tier** — full pipeline:
- Proceed through all phases with no shortcuts. This is the default behavior.

**Gate**: always — triage is a classification step, never blocks.

### Dynamic Model Routing by Tier

When spawning subagents, override the default model based on the feature tier:

| Agent | PATCH | MINOR | MAJOR |
|-------|-------|-------|-------|
| ceo-founder | skip | model: sonnet | model: opus (default) |
| final-user | skip | model: sonnet | model: opus (default) |
| lead-dev | model: sonnet | model: sonnet | model: opus (default) |
| vision-facilitator | skip | skip | model: opus (default) |
| architect | skip | model: sonnet (default) | model: sonnet (default) |
| All other agents | model: sonnet (default) | model: sonnet (default) | model: sonnet (default) |

Apply the override by passing the `model` parameter when launching subagents (e.g., `subagent_type: "lead-dev", model: "sonnet"` for PATCH/MINOR tiers).
"skip" means the agent is not invoked for that tier (the phase it belongs to is skipped entirely).

---

## Phase 3: Feature Spec

### Pre-Spec: Inject Cross-Feature Learnings

Before starting the spec, read `.claude/state/factory-learnings.json` and inject relevant lessons (max 5, most recent first) as context for this feature. Learnings matching the feature's domain, applicable agents, or similar seed text get priority. Include the learning context block in the prompts for Dev, QA, and UX agents when they are spawned later.

### Visual Design Language

Produce a brief **Visual Design Language** for this feature:
- Color palette (primary, secondary, accent — referencing existing design tokens where possible)
- Typography hierarchy (headings, body, labels, captions)
- Spacing language (consistent padding/margin scale)
- Component patterns (how cards, lists, forms, modals should look for THIS feature)
- Visual identity (what makes this feature feel distinctive vs. generic)

## Phase 4: Architecture Lock

Write the Implementation Contract:
- List every file to create or modify (with expected changes)
- Define every test assertion the Dev commits to writing (one per acceptance criterion, plus edge cases)
- Explicitly list deferred edge cases — things the Dev will NOT handle in this sprint and why
- State the approach: key patterns, data flow, component structure
- Estimate test count: unit, integration, E2E

## Phase 5: TDD Sprint

**Agent**: devops

### Phase 4a: Environment Setup

Launch a **devops subagent** (subagent_type: "devops").

Follow idea-to-feature Phase 5:
- Verify build tools, package managers, test runner
- Install new dependencies from ADR
- Create infrastructure (migrations, services, env vars)
- Run clean build to establish green baseline
- Document rollback procedure

**Gate**: always — blocking issues halt the pipeline.

### Phase 4b: TDD Implementation

Launch a **dev subagent** (subagent_type: "dev"). **Security** gates run automatically within each iteration.

Follow idea-to-feature Phase 6 with **max 6 iterations** (increased from 4 for autonomous mode):

For each user story (Must Have first):
- **Red**: Write failing unit + integration tests from acceptance criteria
- **Green**: Minimal implementation to pass tests
- **Refactor**: Clean up, run ALL tests

**Security gates per iteration** (subagent_type: "security"):
- Secrets scan — hard stop on detection
- SAST on new/modified files
- Dependency audit for CVEs

**Loop exit**: All stories implemented · all tests green · no regressions · security gates clean.

**Autonomy adaptation**: If loop has not exited after 6 iterations:
- Do NOT halt for human (autonomous mode)
- Skip this feature, mark `needs_dev_unblock`
- Move to next feature in backlog

**Gate**: all_approved — 100% tests green · existing suite unbroken · security gates clean.

### Phase 5c: Dev Self-Review

Before handing off to Adversarial Review, the **dev subagent** performs a self-evaluation checkpoint:

1. **Sprint Contract walk-through**: Check each criterion from the Implementation Contract. For every item, confirm: implemented? Test written? Passing?
2. **Quick browser smoke test** (for UI features): Launch the dev server, `browser_navigate` to the feature, walk the happy path via `browser_click`/`browser_fill_form`. Fix anything obviously broken.
3. **Log pre-QA findings**: Record any issues found and fixed during self-review. This prevents wasting evaluator time on obvious bugs the Dev could have caught.
4. **Confirm readiness**: Dev states which Sprint Contract items are fully addressed and which (if any) are deferred with rationale.

**Gate**: Dev confirms all Implementation Contract items are addressed (or explicitly deferred). This is NOT a quality gate — it's a sanity check. The real evaluation happens in Phase 6.

---

## Phase 6: Adversarial Review

**Agent**: two

**Agent**: security

### Phase 5a: Code Review

Launch two subagents **in parallel** (idea-to-feature Phase 7). Security and Lead Dev review independent dimensions (OWASP vs code quality) so they do not depend on each other's output:

**Security subagent** (subagent_type: "security"):
- OWASP Top 10 review on new/modified code
- Verify all security findings from Phase 5 TDD gates were resolved
- Output: `[APPROVE]` or `[VETO]`

**Lead Dev subagent** (subagent_type: "lead-dev"):
- Code review: quality, consistency, TDD compliance
- Verify Dev/QA test layer boundary respected
- Verify UX Spec correctly implemented
- Output: `[APPROVE]`, `[APPROVE-WITH-CONCERNS: {concerns}]`, or `[VETO]`

`[APPROVE-WITH-CONCERNS]` is a non-blocking pass. It does not halt the pipeline, but the flagged concerns are forwarded to the QA subagent in Phase 6b as areas requiring extra scrutiny.

**Gate**: no_veto — both must approve. Wait for both parallel subagents to complete before evaluating the gate.

On `[VETO]` from Lead Dev: return to Phase 4b with feedback (max 2 extra iterations).
On `[VETO]` from Security (ABSOLUTE): **skip feature immediately**, mark `blocked_security_veto` — do not retry security vetoes.

### Phase 5b: E2E Validation

Launch **qa + security** subagents in parallel (idea-to-feature Phase 8):

**QA subagent** (subagent_type: "qa-tester"):
- Write Playwright E2E tests for critical user journeys
- Run full suite: unit + integration + E2E
- Verify >= 80% code coverage on new code
- Test adversarial scenarios
- Output: `[APPROVE]` or `[VETO]`

**Security subagent** (subagent_type: "security"):
- Final secrets scan
- Dependency audit
- Verify Phase 5a vetoes resolved
- Output: `[APPROVE]` or `[VETO]`

**Gate**: all_approved — both must approve.

---

## Phase 7: Documentation

**Agent**: tech-writer

Launch a **tech-writer subagent** (subagent_type: "tech-writer").

Follow idea-to-feature Phase 9:
- API docs for new/modified endpoints
- Changelog entry (Keep a Changelog format)
- User guide delta
- ADR stored in `docs/adr/`
- Domain Glossary updated
- SLO documentation (if SRE was invoked)

**Gate**: always — documentation must exist before UX review and Final User review.

---

## Phase 8: UX & Accessibility Polish

**Agent**: ux-designer

**Trigger**: Only runs for features that include frontend/UI changes. Detection: check if any file in the diff matches `frontend/src/components/**`, `frontend/src/app/**`, or `*.tsx`.

If no UI files changed (backend-only feature), **skip this phase entirely** — go straight to Phase 9 (Final User).

### Process

Launch a **ux-designer subagent** (subagent_type: "ux-designer"). This is a code-level review — no running app or browser needed.

**Step 1: UX spot-check** (reference `.claude/skills/ux-audit.md`):
- For each new/modified component: verify loading, error, and empty states exist
- For each new interactive element: verify hover, focus, active, disabled states
- Check microcopy on new buttons, messages, and labels
- Identify missing UX patterns (e.g., no confirmation on destructive action, blank screen while loading)

**Step 2: Accessibility check** (reference `.claude/skills/accessibility-audit.md`, abbreviated):
- Semantic HTML: landmarks, heading hierarchy (no skipped levels), form labels
- ARIA: `aria-label` on icons/buttons, `aria-expanded`/`aria-controls` on toggles, `aria-live` on dynamic content
- Keyboard: Tab order logical, Enter/Space activation, Escape to close modals/drawers
- Contrast: new text/background combinations meet 4.5:1

**Step 3: Design consistency check** (reference `.claude/skills/design-system-implementation.md`, abbreviated):
- Uses design tokens (no hardcoded colors, spacing, or font sizes)
- Responsive: component renders at 375px, 768px, 1280px widths
- Consistent with existing components (same patterns for similar UI)

### Output

Categorize findings as:
- **Blocking**: Missing loading/error/empty states, broken keyboard nav, no ARIA labels, skipped heading levels, hardcoded colors — these MUST be fixed before Final User review
- **Recommended**: Suboptimal but functional — logged in findings for Final User awareness, not blocking

### Auto-fix

The UX Designer agent fixes **blocking findings** directly:
- Add missing `aria-label` attributes
- Add missing loading/error/empty state handling
- Fix heading hierarchy
- Replace hardcoded values with design tokens

After fixing, verify the build still passes.

**Gate**: All blocking findings resolved. Max 5 fix attempts.

If blocking findings remain after 5 fix attempts: skip feature, mark `needs_ux_polish`.

Recommended findings are passed to Phase 9 (Final User) as context — the Final User will factor them into the UX and Accessibility scores.

---

## Phase 9: Final User Quality Gate

**Agent**: final-user
**Tier requirement**: MINOR and MAJOR only. PATCH features skip this phase entirely.

The Final User is the **customer** — not an engineer. They evaluate the feature the way a real user would: does it work, is it complete, does it feel good, is it polished? Code quality, security, and accessibility are already handled by earlier phases (Lead Dev, Security agent, UX Designer).

### Evaluator Calibration Check

If `iteration % 5 === 0` (every 5th feature): before running the Final User evaluation, invoke `.claude/skills/evaluator-calibration.md` to review past evaluation accuracy and update `.claude/state/calibration-amendments.md`. This ensures the evaluator learns from its own history.

### Voting Protocol (MAJOR tier only)

For **MAJOR** features, use the **Voting** parallelization pattern to reduce single-evaluator bias:

1. Launch **2 Final User subagents in parallel**, each performing the full evaluation independently
2. Collect both scores: `score_a` and `score_b`
3. **If scores diverge by <= 15 points**: take the **lower** score (conservative)
4. **If scores diverge by > 15 points**: launch a **3rd Final User subagent**, take the **median** of all 3 scores
5. Store all votes in state: `current_feature.final_user_votes: [score_a, score_b, score_c?]`
6. The winning score and its corresponding report become the official evaluation

For MINOR features, run a single Final User evaluation as before (no voting).

### Evaluation

Full evaluation following the Final User Agent protocol (subagent_type: "final-user"). The Final User reads `.claude/state/calibration-amendments.md` before scoring.

1. Read the feature spec and the Sprint Contract — understand what problem this solves and what was agreed
2. Read the changed files — focus on UI components, flows, and behavior
3. Run the tests — verify they pass
4. **Live Browser Walkthrough** (for features with UI changes):
   - Launch the dev server if not running
   - For each user flow defined in the Sprint Contract's User Acceptance Contract:
     - `browser_navigate` to the entry point
     - `browser_snapshot` to capture the accessibility tree
     - `browser_click` / `browser_fill_form` to walk the flow step by step
     - `browser_take_screenshot` at each significant state (empty, loading, error, success)
     - `browser_console_messages` to check for JS errors
     - `browser_resize` to test at 375px (mobile) and 1280px (desktop)
   - Any user flow that cannot be completed via browser interaction is an automatic P1 weakness
   - For backend-only features: skip this step
5. Walk through user flows using browser evidence — reference screenshots and snapshots from Step 4
6. Score on 4 customer-facing dimensions (total /100):
   - Does It Work? (0-25) · Is It Complete? (0-20) · How Does It Feel? (0-30) · Is It Polished? (0-25)
7. Identify strengths (3-7 items the user would appreciate)
8. Identify weaknesses (3-7 items, prioritized P1/P2/P3 with fix suggestions). Mark each weakness as `[IMPL]` (implementation bug — fixable by REFINE) or `[APPROACH]` (design/direction issue — requires PIVOT)
9. Fill in the **complete** Report Card template to `Docs/reports/FF-{FP-NNN}-{kebab-name}.md`
10. Update `.claude/state/final-user-reports.json`

If Phase 8 (UX Polish) produced recommended findings, include them as context — factor into "How Does It Feel?" and "Is It Polished?" scores.

### Verdict Rules

- **Total >= 80**: **APPROVE** — proceed to ship
- **Total 75-79 AND no P1 weaknesses AND all dimensions >= 50% of max**: **CONDITIONAL APPROVE** — ships, but the feature is flagged for the next `/improve-loop` cycle. Mark in state: `status: "shipped_conditional"`, add feature ID to `metrics.needs_polish[]`
- **Total 60-79** (not meeting CONDITIONAL APPROVE criteria): **REVISE** — send back with classified feedback, max 8 retries (see Revision Protocol below)
- **Total < 60**: **REJECT** — skip feature, log report
- **Any dimension < 50% of its max**: **REVISE** regardless of total — can't ship with a failing area
- **Any P1 weakness**: **REVISE** regardless of total

Per-dimension minimums (50% of max): Does It Work 13/25, Is It Complete 10/20, How Does It Feel 15/30, Is It Polished 13/25.

For backend-only features with no UI changes: "How Does It Feel?" (30/30) and "Is It Polished?" (25/25) scored as full marks with note "N/A — backend only".

### Revision Protocol (Refine vs. Pivot)

When the Final User returns REVISE, the Dev must explicitly choose a revision strategy before making changes:

**REFINE** — "The current approach is sound. I will fix the specific issues identified."
- Choose when: score >= 65, weaknesses are tagged `[IMPL]`, no repeated P1s across revision rounds
- Action: Address each P1/P2 item directly, re-run tests, resubmit

**PIVOT** — "The current approach has a fundamental issue. I will change the overall direction."
- Choose when: any dimension < 50% of max, weaknesses tagged `[APPROACH]`, or the same P1 persists across 2+ revision rounds
- Action: Rethink the UI pattern, data flow, or component structure. Write a brief explanation of the new direction before implementing.

The Dev writes a 2-3 sentence **Revision Strategy** logged in the state file under `current_feature.revision_history[]`.

**Plateau detection**: If the score does not improve by >= 5 points across 2 consecutive revisions, automatically switch to PIVOT. If the score stalls after a PIVOT, skip the feature.

**Max retries**: 8 (increased from 5 to allow the refine/pivot cycle room to converge). After 8 retries without reaching 80: skip feature, mark `final_user_rejected`.

## Phase 10: Ship

**Only reached if Phase 9 Final User approved (score >= 80, no dimension below 50% of max).**

Run `.claude/skills/ship-fully-automated-ship-workflow.md` in fully automated mode:
- Detect base branch
- Merge base branch into feature branch
- Run full test suite
- Review diff
- Bump VERSION
- Update CHANGELOG
- Commit, push, create PR

**Autonomy adaptation**: The ship workflow's only stop conditions are:
- On the base branch (abort — should never happen in worktree)
- Merge conflicts that can't be auto-resolved → skip feature, mark `blocked_merge_conflict`
- Test failures → skip feature, mark `blocked_test_failure`

**Gate**: always — ship runs non-interactively.

After successful ship:
- Update backlog: feature status → `shipped` (or `shipped_conditional` if CONDITIONAL APPROVE)
- Update factory state: increment `features_shipped`, record `avg_final_user_score`
- If feature `source` is `"user"`: update `factory-seeds.md` — mark the corresponding line as `[DONE]`
- Log: `"Feature FP-{NNN} shipped with Final User score {XX}/100"`

### Post-Ship: Cross-Feature Learning

After every ship or skip, run `.claude/skills/cross-feature-learning.md`:
1. Record observations from this feature (weaknesses, skip reasons, timing anomalies)
2. Check if any pending observations have reached the 3-occurrence threshold
3. Graduate qualifying observations to learnings in `.claude/state/factory-learnings.json`
4. These learnings will be injected as context for future features at Phase 3

### Post-Ship: Dashboard (every 3rd feature)

If `metrics.features_shipped % 3 === 0`, run `.claude/skills/factory-dashboard.md` to generate an updated dashboard at `Docs/reports/factory-dashboard.md`. This surfaces bottlenecks, score trends, and alerts without requiring manual invocation.

---

## State File Schema

```json
{
  "pipeline": "feature-factory",
  "status": "running|idle|blocked|waiting_for_backlog",
  "iteration": 0,
  "current_feature": {
    "id": "FP-001",
    "name": "Feature Name",
    "tier": "PATCH|MINOR|MAJOR",
    "tier_rationale": "Classification reason",
    "tier_escalated_from": null,
    "phase": 1,
    "phase_name": "discovery",
    "started_at": "ISO-8601",
    "last_update": "ISO-8601",
    "final_user_votes": [],
    "revision_history": [
      {
        "round": 1,
        "strategy": "REFINE|PIVOT",
        "rationale": "Brief explanation",
        "score_before": 0,
        "score_after": 0
      }
    ],
    "sprint_contract": {
      "status": "pending|agreed|conflict_unresolved",
      "implementation_contract": true,
      "evaluation_contract": true,
      "user_acceptance_contract": true,
      "unresolved_conflicts": []
    },
    "phase_timings": [
      {
        "phase": "4.5",
        "phase_name": "sprint_contract",
        "started_at": "ISO-8601",
        "completed_at": "ISO-8601",
        "duration_seconds": 0,
        "iterations": 1,
        "outcome": "completed|skipped|vetoed"
      }
    ],
    "total_duration_seconds": 0
  },
  "shipped": [
    {
      "id": "FP-001",
      "name": "Feature Name",
      "final_user_score": 85,
      "shipped_at": "ISO-8601"
    }
  ],
  "skipped": [
    {
      "id": "FP-003",
      "name": "Feature Name",
      "reason": "blocked_security_veto",
      "skipped_at": "ISO-8601"
    }
  ],
  "metrics": {
    "features_shipped": 0,
    "features_skipped": 0,
    "avg_final_user_score": 0,
    "total_iterations": 0,
    "discovery_runs": 0,
    "last_calibration": {
      "iteration": 0,
      "date": null,
      "amendments_added": 0,
      "amendments_resolved": 0
    },
    "avg_phase_durations": {
      "seed_ingestion": 0,
      "discovery": 0,
      "feature_spec": 0,
      "architecture_lock": 0,
      "sprint_contract": 0,
      "tdd_sprint": 0,
      "adversarial_review": 0,
      "documentation": 0,
      "ux_polish": 0,
      "final_user": 0,
      "ship": 0
    },
    "bottleneck_phase": null,
    "total_pipeline_duration_avg": 0,
    "needs_polish": [],
    "tier_distribution": {
      "PATCH": 0,
      "MINOR": 0,
      "MAJOR": 0
    }
  }
}
```

---

## Failure Handling Summary

| Failure | Phase | Action |
|---------|-------|--------|
| Backlog empty, discovery produces 0 | 1 | Set `waiting_for_backlog`, retry next tick |
| CEO rejects spec after 2 revisions | 2 | Skip feature → `needs_human_review` |
| Architect/Lead Dev veto after 2 iterations | 3 | Skip feature → `needs_architect` |
| TDD loop exhausted (6 iterations) | 4 | Skip feature → `needs_dev_unblock` |
| Security ABSOLUTE veto | 5 | Skip feature immediately → `blocked_security_veto` |
| Lead Dev veto after 2 extra iterations | 5 | Skip feature → `needs_lead_dev_review` |
| QA veto (coverage < 80% or E2E failures) | 5 | Skip feature → `needs_qa_review` |
| UX blocking findings not resolved after 5 fix attempts | 7 | Skip feature → `needs_ux_polish` |
| Final User score < 60 | 8 | Skip feature → `final_user_rejected` |
| Final User score 60-79, still < 80 after 8 revisions | 9 | Skip feature → `final_user_rejected` |
| Final User score plateaus (< 5pt improvement across 2 revisions) | 9 | Auto-PIVOT, then skip if still stalled |
| Merge conflicts during ship | 9 | Skip feature → `blocked_merge_conflict` |
| Test failure during ship | 9 | Skip feature → `blocked_test_failure` |

**On any skip**: Log the reason, save the Final User report (if available), move to next backlog item. If feature `source` is `"user"`, mark the corresponding seed line as `[SKIPPED: {reason}]` in `factory-seeds.md`. Never halt the pipeline — always continue to the next feature.

### Phase Timing Protocol

At the **start** of every phase, record `started_at` in `current_feature.phase_timings[]`. At the **end** of every phase (gate check), record `completed_at` and compute `duration_seconds`. After shipping or skipping a feature, compute `total_duration_seconds` and update `avg_phase_durations` in metrics. Set `bottleneck_phase` to the phase with the highest average duration. This data enables comparing the cost of different pipeline configurations (e.g., does Sprint Contract Negotiation save more time in revisions than it costs?).

---

## Workflow Summary

```
Phase 0    │ User Seed Ingestion (every tick)   │ (built-in)                    │ always
Phase 1    │ Autonomous Discovery (conditional) │ Architect+UX+Data+BA+PM+CEO  │ only if no user seeds + auto < 3
Phase 2.5  │ Triage (PATCH/MINOR/MAJOR)         │ triage-router.md              │ always (routes pipeline)
Phase 3    │ Feature Spec                       │ BA+Architect+LeadDev+UX+QA    │ ceo_approval (MINOR+MAJOR only)
Phase 4    │ Architecture Lock                  │ Architect+LeadDev [+SRE]      │ no_veto (MINOR+MAJOR only)
Phase 4.5  │ Sprint Contract Negotiation        │ Dev+QA+FinalUser+LeadDev      │ contract_agreed (MAJOR only)
Phase 5    │ TDD Sprint                         │ DevOps+Dev+Security (×2/3/6)  │ all_tests_green + gates_clean
Phase 6    │ Adversarial Review + E2E           │ Security‖LeadDev+QA           │ no_veto + all_approved
Phase 7    │ Documentation                      │ TechWriter                    │ always (MINOR+MAJOR only)
Phase 8    │ UX & Accessibility Polish          │ UX Designer                   │ blocking_resolved (MAJOR only, skip if no UI)
Phase 9    │ Final User (Customer) Quality Gate  │ FinalUser                     │ score >= 80 (MINOR+MAJOR only)
Phase 10   │ Ship                               │ DevOps (ship.md)              │ always (non-interactive)
```

**Tier shortcuts**: PATCH skips Phases 3-4.5, 7-9 (Dev->Review->Ship). MINOR skips 4.5, conditionally 8. MAJOR runs all.
**Phase 6 change**: Security ‖ Lead Dev now run **in parallel** (independent dimensions).

**User seed priority**: User ideas from `factory-seeds.md` are always tackled before auto-discovered features.
When all user seeds are done, the factory seamlessly transitions to autonomous discovery.
The user can add new seeds at any time — they jump to the front of the queue on the next iteration.

**Human touch points**: 0 (fully autonomous)
**Veto authorities**: Architect (STRONG) · Lead Dev (STRONG) · Security (ABSOLUTE) · UX Designer (BLOCKING on a11y/UX) · Final User (STRONG)
**Total agents involved**: 15 distinct roles