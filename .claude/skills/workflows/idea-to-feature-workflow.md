# Idea-to-Feature Workflow

Turn a one-line feature idea into a production-ready implementation on an existing project.

## Phase 1: Codebase Discovery

Understand the existing project before writing a single requirement.
- Scan the repository structure: modules, entry points, existing patterns
- Identify domain concepts already in the codebase that relate to the feature
- Map existing data models and API contracts that the feature may touch
- List implicit constraints (multi-tenancy, auth, rate limiting, existing conventions)
- Apply the **5 Whys** technique to the raw feature text to surface the real need
- Check whether a project Domain Glossary already exists at `docs/glossary.md`; if not, flag that it will be created from scratch in Phase 2
- Output: **Context Report** — codebase summary, related modules, domain terms, inferred constraints, 5-Whys chain, glossary status

## Phase 1.5: Triage / Complexity Classification

Follow `.claude/skills/triage-router.md` to classify the feature as **PATCH**, **MINOR**, or **MAJOR** based on the Context Report from Phase 1.

- **PATCH**: Skip Phases 2-4. Jump to Phase 5 (Environment Setup) then Phase 6 (TDD, max 2 iterations) then Phase 7 (Adversarial Review: Lead Dev + Security only) then Phase 11 (Deploy).
- **MINOR**: Proceed through all phases. TDD max 3 iterations. Skip Phase 8 (UX Polish) if no frontend files.
- **MAJOR**: Proceed through all phases with no shortcuts.

Lead Dev can escalate the tier upward during Phase 7. Escalation re-enters the pipeline at Phase 2.

**Gate**: always.

---

## Phase 2: Requirement Refinement

Transform the raw idea into sprint-ready user stories.
- Use the Context Report from Phase 1
- Apply INVEST: every story must be Independent, Negotiable, Valuable, Estimable, Small, Testable
- Write 1–N user story cards using the standard format:
  ```
  Story: [ID] — [Title]
  As a [specific persona], I want [concrete action] so that [measurable benefit].

## Phase 3: UX Design

Design the user experience for the approved stories.
- Read the user story cards and the codebase's existing UI components / design system
- If the feature has no UI impact, output an explicit **empty UX Spec** with written rationale and skip to Phase 4
- Produce component specifications (new components or modifications to existing ones)
- Define all required states for each component: loading · empty · error · success
- Guarantee WCAG 2.1 AA: aria-*, contrast ≥ 4.5:1, keyboard navigation
- Use only existing design tokens — no hardcoded colors or spacing
- Specify responsive behaviour: mobile, tablet, desktop breakpoints
- Output: **UX Spec** — component list, state matrix, accessibility checklist, design token usage

## Phase 4: Architecture & NFR Impact Analysis

Launch **architect** + **lead-dev** subagents in parallel. If any NFR-tagged stories exist, also launch **sre** in parallel.

**Architect task** (subagent_type: "architect"):
- Read the user stories, UX Spec, Context Report, and Assumption Log
- Identify which existing modules are affected and how
- Define new API contracts, data model changes, and integration points
- Write an **ADR** with at least 2 architectural options considered:
  1. Context: what the feature needs architecturally
  2. Options: ≥ 2 alternatives with pros/cons (e.g. extend existing module vs new module)
  3. Decision: chosen option with justification
  4. Consequences: risks, breaking changes, migration needs
- Output: ADR · updated component diagram · API contracts · data model delta · list of files to create/modify

**Lead Dev task** (subagent_type: "lead-dev"):
- Review the ADR for KISS and YAGNI compliance
- Review the UX Spec for implementability: are the component states achievable with the current stack? Are all design tokens available?
- Check consistency with existing codebase conventions (naming, layering, error handling)
- Flag over-engineering, missing concerns, or UX/architecture mismatches
- Output: [APPROVE] or [VETO] with specific feedback on both ADR and UX Spec

**SRE task** (subagent_type: "sre") — *run only if NFR-tagged stories exist*:
- Define **SLIs and SLOs** for the feature before any implementation begins
  - Example: `p99 latency < 200ms under 100 concurrent users`, `availability ≥ 99.9%`
- Define the error budget impact if the feature degrades existing SLOs
- Specify observability requirements: which metrics, logs, and traces must be instrumented
- Output: SLO definitions · error budget impact · observability instrumentation list

**Gate**: no_veto — architect and lead dev must both approve. SRE output is mandatory if invoked (no veto power, but SLO definitions are binding for Phase 6).

If [VETO]: architect revises the ADR (and/or UX Designer revises the UX Spec) and lead dev re-reviews (max 2 iterations).

---

## Phase 5: Environment Setup

Prepare the development environment for the incoming changes.
- Verify build tools, package managers, and test runner are operational
- Install any new dependencies identified in the ADR
- Create or update required infrastructure (database migrations, new services, env vars)
- Run a clean build on the current codebase to establish a green baseline
- Document the rollback procedure for this feature's changes, including:
  - How to revert database migrations
  - How to roll back the canary if metrics degrade
  - Definition of "minor issue" vs "blocking issue" for this deploy (e.g. missing optional env var = minor; broken migration = blocking)
- Output: environment readiness report · rollback plan · issue severity classification

## Phase 6: TDD Sprint + Continuous Security

Implement the feature following strict Red-Green-Refactor.

## Phase 7: Adversarial Review

**Agent**: two

Launch two subagents in sequence:

**1. Security subagent** (subagent_type: "security"):
- OWASP Top 10 review scoped to the new/modified code
- Special attention to: new API endpoints (auth, input validation), new data models (PII, injection), new dependencies (CVEs)
- Verify that all security gate findings from Phase 6 were resolved (no carry-forward)
- Output: [APPROVE] or [VETO] with vulnerability description, exploit scenario, and fix

**2. Lead Dev subagent** (subagent_type: "lead-dev"):
- Code review: quality, consistency, maintainability
- Verify TDD compliance: unit and integration tests exist, were written before implementation, and match the Acceptance Criteria
- Verify Dev/QA test layer boundary was respected (no E2E tests in Phase 6 code)
- Check that implementation matches the ADR decisions
- Verify UX Spec is correctly implemented: all component states present, accessibility attributes in place, no hardcoded values
- Output: [APPROVE] or [VETO] with specific line-level feedback

**Gate**: no_veto — both must approve. On [VETO]: return to Phase 6 with feedback, max 2 extra iterations. If still failing after 2 extra iterations, escalate to human.

---

## Phase 8: E2E Validation

Launch **qa** and **security** subagents in parallel.

**QA subagent** (subagent_type: "qa-tester"):
- Write Playwright E2E tests for every critical user journey defined in the stories (QA owns E2E — these are new tests, not duplicates of Phase 6 unit/integration tests)
- Run full test suite: unit (Phase 6) + integration (Phase 6) + E2E (Phase 8)
- Verify minimum 80% code coverage on new code
- Test adversarial scenarios exclusively: empty inputs, boundary values, concurrent access, race conditions — scenarios Dev would not typically cover
- If SLO definitions exist, run load tests and verify the defined thresholds are met in a staging environment
- Output: [APPROVE] with coverage report and E2E results, or [VETO] with failing test details

**Security subagent** (subagent_type: "security"):
- Final secrets scan (no credentials or tokens in code/config)
- Dependency audit for newly introduced CVEs
- Verify all [VETO] items from Phase 7 are resolved
- Output: [APPROVE] or [VETO]

**Gate**: all_approved — both must approve before documentation.

---

## Phase 9: Documentation

Document everything introduced by this feature.
- **API docs**: every new or modified endpoint (method, path, request body, response, error codes, curl example)
- **Changelog entry**: follow Keep a Changelog format (Added / Changed / Fixed)
- **User guide delta**: update or create the relevant section of the user guide
- **ADR**: confirm the ADR from Phase 4 is stored in `docs/adr/` with correct naming convention
- **Domain Glossary**: merge new terms from Phase 2 into `docs/glossary.md` (create the file if Phase 1 found it absent)
- **SLO documentation** (if SRE was invoked in Phase 4): document the defined SLIs/SLOs in `docs/slo/` so they are visible to on-call engineers
- Output: updated API docs · CHANGELOG.md entry · user guide section · confirmed ADR location · updated glossary · SLO doc (if applicable)

## Phase 10: Deploy

**⏸ HUMAN CHECKPOINT — Final GO / NOGO before production.**

Present a deployment summary to the human:
- Feature implemented: list of user stories completed
- Test results: unit coverage %, E2E pass/fail, load test results (if applicable)
- Security review outcome + security gate summary
- Files changed (added / modified / deleted)
- Rollback plan (from Phase 5), including severity classification
- Any open assumptions (Status: Unvalidated) or known limitations

Human decides:
- **GO** → proceed with deploy
- **NOGO** → specify what needs to change; route back to the appropriate phase

**If GO**: Launch a **devops** subagent.

**Deploy task**:
1. Run full test suite one final time — must be green
2. Run infrastructure checks (ports, services, disk, memory)
3. Canary deploy to small traffic slice
4. Monitor metrics for 15 minutes (error rate, latency, resource usage) — compare against SLO thresholds if defined
5. Full rollout only after canary success
6. Post-deploy smoke tests to verify feature is live

**Gate**: human_approval + canary_success

---

## Workflow Summary

```
Phase  1  │ Codebase Discovery          │ BA                              │ auto
Phase  2  │ Requirement Refinement      │ BA                              │ ⏸ HUMAN APPROVAL
Phase  3  │ UX Design                   │ UX Designer                     │ auto (explicit empty spec if no UI)
Phase  4  │ Architecture & NFR Analysis │ Architect + Lead Dev [+ SRE*]   │ no_veto (SRE SLOs binding if invoked)
Phase  5  │ Environment Setup           │ DevOps                          │ auto (blocking issues halt)
Phase  6  │ TDD Sprint + Security Gates  │ Dev + Security gates (loop ×4)  │ all_tests_green + gates_clean
Phase  7  │ Adversarial Review          │ Security + Lead Dev             │ no_veto
Phase  8  │ E2E Validation              │ QA + Security (parallel)        │ all_approved
Phase  9  │ Documentation               │ Tech Writer                     │ auto
Phase 10  │ Deploy                      │ DevOps                          │ ⏸ HUMAN APPROVAL
```

`*` SRE invoked only when NFR-tagged stories exist (performance, latency, availability).

**Test layer ownership**:
| Layer | Owner | Phase |
|---|---|---|
| Unit tests | Dev | 6 |
| Integration tests | Dev | 6 |
| E2E tests | QA | 8 |
| Adversarial / boundary | QA | 8 |
| Performance / load | QA (with SRE SLOs) | 8 |
| Secrets + SAST | Security | 6 (each iteration) |

**Loop escalation policy**:
| Loop | Max iterations | On breach |
|---|---|---|
| TDD Sprint (Phase 6) | 4 | Halt → human decision |
| Veto recovery (Phase 7) | 2 extra | Halt → human decision |
| ADR revision (Phase 4) | 2 | Halt → human decision |

**Human touch points**: 2 (story approval · deploy GO/NOGO).  
**Veto authorities**: Architect (STRONG) · Lead Dev (STRONG) · Security (ABSOLUTE).  
**Total agents involved**: 9 distinct roles, up to 14 subagent invocations.