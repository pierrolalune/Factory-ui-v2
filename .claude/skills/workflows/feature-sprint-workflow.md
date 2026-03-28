# Feature Sprint Workflow

End-to-end feature development from architecture to deployment.

## Phase 1: Architecture Design

**Agent**: architect

Design the feature architecture.
- Analyze requirements and acceptance criteria
- Identify components to create/modify
- Define API contracts and data models
- Document the design as an ADR with at least 2 options considered
- Output: component design, API contracts, data model, file list

## Phase 2: Environment Setup

**Agent**: devops

Prepare the development environment.
- Verify build tools and dependencies are installed
- Set up any required infrastructure (database, services)
- Ensure test framework is configured
- Run initial build to verify clean state

## Phase 3: TDD Sprint

**Agent**: dev

Implement the feature using strict TDD.
- **Red**: Write failing tests that define the expected behavior
- **Green**: Write the minimum code to make tests pass
- **Refactor**: Clean up without changing behavior, run all tests
- Loop until all tests pass

## Phase 4: Adversarial Review

**Agent**: two

Launch two subagents in sequence:

1. **Security subagent** (subagent_type: "security"):
   - Review for OWASP Top 10 vulnerabilities
   - Check for exposed secrets, injection points
   - Verify input validation and auth checks
   - Output: [APPROVE] or [VETO] with specific issues

2. **Lead Dev subagent** (subagent_type: "lead-dev"):
   - Code review for quality, consistency, maintainability
   - Verify TDD compliance (tests written first)
   - Check naming conventions and code style
   - Output: [APPROVE] or [VETO] with feedback

**Gate**: no_veto — both reviewers must not veto.

## Phase 5: E2E Test Writing

Write E2E tests for the new/modified feature.

## Phase 6: E2E Validation

Launch QA and security subagents in parallel:

- **QA subagent** (subagent_type: "qa-tester"):
  - Run the new E2E tests from Phase 5: `npx playwright test {spec-files}`
  - If tests fail: fix the tests or the implementation, then re-run
  - Run the full test suite to check for regressions
  - Output: [APPROVE] with test results or [VETO] with failures

- **Security subagent** (subagent_type: "security"):
  - Final secrets scan
  - Dependency audit for CVEs
  - Output: [APPROVE] or [VETO]

**Gate**: all_approved — both must approve, all E2E tests must pass.

---

## Phase 7: Technical Documentation Update

Update the technical documentation to reflect the delivered feature.

## Phase 8: Deploy

Pause for human approval before deploying.

- Present summary of changes, test results, review outcomes, and doc updates
- Human decides: GO (deploy) or NOGO (back to sprint)
- If GO: run deploy steps via devops subagent