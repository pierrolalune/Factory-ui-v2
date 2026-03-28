# Idea-to-App Workflow

Takes a brief idea (1-4 sentences) and produces a fully running, tested, polished application from scratch. Orchestrates: Product Vision → Scaffold → Decompose → Build → Improve → Polish → Report.

## Phase 1: Init / Resume

Read `.claude/state/idea-to-app-state.json`.

### First Run (state file does not exist or `status` is `completed`/`aborted`)

1. Parse `$ARGUMENTS` — extract the 1-4 sentence idea
2. Validate: idea must be at least 10 characters. If empty/too short, set `status: "aborted"`, STOP.
3. Write initial state:
   ```json
   {
     "pipeline": "idea-to-app",
     "status": "running",
     "original_idea": "{the idea}",
     "product_name": null,
     "product_slug": null,
     "tech_stack": null,
     "current_phase": 1,
     "current_phase_name": "product_vision",
     "started_at": "ISO-8601",
     "last_update": "ISO-8601",
     "phase_1_vision": { "status": "pending", "started_at": null, "completed_at": null, "duration_seconds": 0, "feature_count": 0, "ai_features_count": 0, "retries": 0 },
     "phase_2_scaffold": { "status": "pending", "started_at": null, "completed_at": null, "duration_seconds": 0, "build_green": false, "claude_md_written": false, "design_md_written": false, "retries": 0 },
     "phase_3_decomposition": { "status": "pending", "started_at": null, "completed_at": null, "duration_seconds": 0, "total_seeds": 0, "sprint_count": 0, "retries": 0 },
     "phase_4_factory": { "status": "pending", "started_at": null, "completed_at": null, "duration_seconds": 0, "total_seeds": 0, "seeds_shipped": 0, "seeds_skipped": 0, "avg_final_user_score": 0, "shipped_features": [], "skipped_features": [] },
     "phase_5_improvement": { "status": "pending", "started_at": null, "completed_at": null, "duration_seconds": 0, "cycles_completed": 0, "cycles_target": 3, "total_seeds_shipped": 0, "avg_score": 0 },
     "phase_6_polish": { "status": "pending", "started_at": null, "completed_at": null, "duration_seconds": 0, "groups_polished": 0, "avg_quality_score": 0 },
     "phase_7_report": { "status": "pending", "started_at": null, "completed_at": null, "duration_seconds": 0, "report_path": null },
     "metrics": { "total_features_planned": 0, "total_features_shipped": 0, "total_features_skipped": 0, "avg_final_user_score": 0, "total_duration_seconds": 0, "bottleneck_phase": null }
   }
   ```
4. Proceed to Phase 1.

### Resume (state exists and `status` is `running` or `degraded`)

1. Read state — determine `current_phase`
2. Resume at the incomplete phase
3. If all phases complete, set `status: "completed"` and write final report

**Gate**: always.

---

## Phase 2: Autonomous Product Vision

Produce the ambitious product vision.
- Restate the core idea and identify the target audience
- Apply the "10-star" test: what would make users tell their friends about this?
- What is the 10x version of this idea for only 2x the effort?
- Identify 3-5 opportunities to weave AI capabilities (Claude API, LLM-powered features, smart defaults, natural language interactions, automated analysis)
- Propose a product name and tagline
- Define the product identity: what makes this distinct from generic apps in the same category?

## Phase 3: Project Scaffold

1. Initialize git repository (`git init`)
2. Create directory structure from Architect's layout
3. Create project manifest based on tech stack:
   - **Next.js**: `package.json` with next, react, react-dom, typescript, tailwindcss, vitest
   - **React SPA + FastAPI**: `package.json` (frontend) + `pyproject.toml` (backend) with fastapi, uvicorn, pytest
   - **SvelteKit**: `package.json` with svelte, sveltekit, vitest, playwright
   - **Python FastAPI**: `pyproject.toml` with fastapi, uvicorn, pytest, ruff
   - **CLI Tool (Node)**: `package.json` with typescript, vitest, commander
   - **CLI Tool (Python)**: `pyproject.toml` with click, pytest, ruff
   - **Fullstack Monorepo**: Turborepo config + shared packages
   - **Mobile Expo**: `package.json` with expo, react-native, jest
4. Install dependencies
5. Set up test runner, linter, build configuration
6. Create `.gitignore` for the tech stack
7. Create initial `README.md` with product name, description, and setup instructions
8. Generate `CLAUDE.md` from `TEMPLATE_CLAUDE.md`:
   - Read `TEMPLATE_CLAUDE.md` from the harness root
   - Replace `{{PROJECT_NAME}}` with the product name from Phase 2
   - Replace `{{DESCRIPTION}}` with a 1-2 sentence product description
   - Replace `{{TECH_STACK}}` with the chosen tech stack and key dependencies
   - Replace `{{PROJECT_STRUCTURE}}` with the directory layout from the Architect
   - Replace `{{PROJECT_CONVENTIONS}}` with stack-specific conventions (e.g., component naming, file organization)
   - Replace `{{DEVELOPMENT_NOTES}}` with any relevant notes (e.g., "AI features use Claude API via @anthropic-ai/sdk")
   - Write the result to `CLAUDE.md` at the project root

## Phase 4: Feature Decomposition

1. Merge PM seeds + Architect ordering
2. Validate: every seed buildable given only prior seeds
3. Group into logical sprints (3-5 seeds per sprint)
4. Validate AI feature seeds placed after the features they enhance
5. Estimate total: typically 5-20 seeds

## Phase 5: Factory Execution

**Goal**: Build every seed through the full Feature Factory pipeline.

### Delegation

Execute the Feature Factory workflow (`.claude/skills/workflows/feature-factory-workflow.md`).

Factory will:
- Ingest `[ITA-S*]` seeds in Phase 0 (user seeds get `wsjf_score: 999`)
- Skip autonomous discovery (user seeds exist)
- Run the full inner pipeline per seed:
  - Feature Spec (CEO review + Visual Design Language)
  - Architecture Lock (Architect + Lead Dev)
  - Sprint Contract Negotiation (Dev + QA + Final User — hard PASS/FAIL thresholds)
  - TDD Sprint (DevOps + Dev + Security gates + Dev Self-Review)
  - Adversarial Review (Security + Lead Dev + QA E2E)
  - Documentation (Tech Writer)
  - UX & Accessibility Polish (UX Designer)
  - Final User Quality Gate (browser testing, score >= 80)
  - Ship
- Mark each seed `[DONE]` or `[SKIPPED: reason]` in `factory-seeds.md`

### Progress Monitoring

After each seed completes, update `idea-to-app-state.json`:
- Increment `seeds_shipped` or `seeds_skipped`
- Record Final User score in `shipped_features[]` or reason in `skipped_features[]`
- Update `avg_final_user_score`

### Completion Detection

When every `[ITA-S*]` line is `[DONE]` or `[SKIPPED]`, Phase 4 is complete.

### Context Management

If session runtime exceeds 90 minutes between seeds, run `/clear` and resume from state. Factory's own state handles crash recovery within its pipeline.

**Gate**: All seeds resolved. Thresholds:
- **>= 50% shipped**: Phase 4 `status: "completed"`, continue normally
- **< 50% shipped**: Phase 4 `status: "degraded"`, continue (improvement cycles may fix issues)
- **0 shipped**: Phase 4 `status: "failed"`, skip to Phase 7 (report what went wrong)

---

## Phase 6: Improvement Cycles

**Goal**: Refine the shipped app with 3 targeted improvement cycles.

### Configuration

Execute the Improve Loop workflow (`.claude/skills/workflows/improve-loop-workflow.md`) with:
- Target: `"the entire application"` (feature manifest = all source files)
- Cycle count: 3
- Fixed angle rotation:

| Cycle | Angle | Why |
|-------|-------|-----|
| 1 | Customer Experience (CX) | Most impactful for new apps — find what's confusing/broken |
| 2 | Visual & Interaction Polish (VP) | Verify VDL was followed, fix state gaps |
| 3 | Edge Cases & Robustness (EC) | Harden: empty states, errors, rapid clicks |

Each improvement seed goes through the full factory pipeline.

### Stall Detection

If 2 consecutive cycles ship 0 seeds: skip remaining cycles, proceed to Phase 6.

If Phase 4 status was `degraded`: improve-loop targets the specific areas that failed.

**Gate**: Improve loop completes (all 3 cycles or stall). No minimum — any improvement is a win.

---

## Phase 7: Final Polish

**Goal**: One cycle of code polisher for quality, security, and performance.

Execute the Code Polisher workflow (`.claude/skills/workflows/code-polisher-workflow.md`) for **one cycle only**:
- Scan all source files
- Multi-skill analysis (code review, quality, efficiency, reuse)
- Architecture review
- Security + performance audit
- Triage, fix, review
- Final User quality gate per file group

**Override**: After one complete cycle (all file groups processed once), STOP. Do not start a second cycle.

**Gate**: One cycle completes. No minimum score.

---

## Phase 8: Final Report

**Goal**: Produce a comprehensive deliverable report.

Launch **tech-writer + product-manager** subagents.

Write to `Docs/reports/ITA-final-{product-slug}.md`:

```markdown
# {Product Name} — Deliverable Report

**Generated by**: /idea-to-app
**Date**: {YYYY-MM-DD}
**Original Idea**: "{the 1-4 sentence input}"
**Total Duration**: {HH:MM:SS}

---

## Executive Summary
{2-3 paragraphs: what was built, features shipped, quality assessment}

## Product Overview
{Name, tagline, target users, value proposition}

## Feature List & Scores

| # | Feature | Status | Final User Score | Notes |
|---|---------|--------|------------------|-------|
| 1 | {Feature} | Shipped | 85/100 | |
| 2 | {Feature} | Skipped | — | {reason} |

**Total**: {N} planned, {M} shipped, {K} skipped
**Average score**: {XX}/100

## Architecture Overview
{Tech stack, structure, data model, key decisions}

## Visual Design Language
{Aesthetic, colors, typography, spacing summary}

## How to Run

### Prerequisites
{prerequisites}

### Setup
\```bash
{setup commands}
\```

### Development
\```bash
{dev server command}
\```

### Build & Test
\```bash
{build and test commands}
\```

## Improvement Cycles Summary

| Cycle | Angle | Proposed | Shipped | Avg Score |
|-------|-------|----------|---------|-----------|
| 1 | Customer Experience | X | X | XX/100 |
| 2 | Visual Polish | X | X | XX/100 |
| 3 | Edge Cases | X | X | XX/100 |

## Code Quality
{Polisher summary: files polished, quality score, key improvements}

## Phase Timings

| Phase | Duration |
|-------|----------|
| 1. Product Vision | {MM:SS} |
| 2. Scaffold | {MM:SS} |
| 3. Decomposition | {MM:SS} |
| 4. Factory | {HH:MM:SS} |
| 5. Improvement | {HH:MM:SS} |
| 6. Polish | {MM:SS} |
| 7. Report | {MM:SS} |
| **Total** | **{HH:MM:SS}** |

## Known Limitations & Future Work
{Skipped features, v2 deferrals, remaining issues}
```

Also update the project's `README.md` with the "How to Run" section.

Set `status: "completed"` in state file.

**Gate**: always.

---

## Progress File

Write to `.claude/idea-to-app-loop.local.md` after each phase:

```markdown
## Idea-to-App — Phase {N}/7
- Status: {status}
- Product: {Product Name}
- Tech Stack: {stack}
- Phase: {N} — {phase_name}
- Features: {shipped}/{total} ({skipped} skipped)
- Avg Score: {XX}/100
- Improvement cycles: {completed}/{target}
- Duration: {HH:MM:SS}
- Next: {what happens next}
```

---

## Failure Handling Summary

| Failure | Phase | Action |
|---------|-------|--------|
| Idea too short (< 10 chars) | 0 | Abort immediately |
| CEO < 5 features after 2 retries | 1 | Proceed with warning |
| Can't determine tech stack | 1 | Default to Next.js |
| Dependency install fails | 2 | Retry once, then abort |
| Build fails after scaffold | 2 | Retry once, then abort |
| < 5 seeds after 2 retries | 3 | Proceed with warning |
| Factory ships < 50% | 4 | Status `degraded`, continue |
| Factory ships 0 | 4 | Status `failed`, skip to Phase 7 |
| Improve loop stalls | 5 | Skip remaining cycles |
| Polisher fails on group | 6 | Skip group, continue |
| Crash at any point | Any | Resume from state file |

**On any skip**: Log the reason, save state, continue. Never halt unexpectedly.

---

## Workflow Summary

```
Phase 0  | Init / Resume                  | (built-in)                     | always
Phase 1  | Autonomous Product Vision      | CEO+Architect+UX+StaffEng+PM   | >= 5 features
Phase 2  | Project Scaffold               | DevOps+UX+LeadDev              | build green
Phase 3  | Feature Decomposition          | PM+Architect+LeadDev           | >= 5 seeds
Phase 4  | Factory Execution              | Full /factory pipeline         | all seeds resolved
Phase 5  | Improvement Cycles (x3)        | Full /improve-loop pipeline    | 3 cycles or stall
Phase 6  | Final Polish (x1)              | Full /polisher pipeline        | 1 cycle complete
Phase 7  | Final Report                   | TechWriter+PM                  | always
```

**Veto authorities**: Same as Feature Factory (Security ABSOLUTE, Architect/Lead Dev STRONG, Final User STRONG, UX BLOCKING)
**Total agents involved**: 14+ distinct roles
**Expected duration**: 2-6 hours depending on app complexity
**Expected cost**: $50-200 depending on feature count