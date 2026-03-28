# Feature Improve Workflow

Structured multi-agent workflow for safely improving an existing feature: deep archaeology of current behavior, impact analysis, TDD implementation with regression guards, adversarial review, and documentation.

## Phase 1: Feature Archaeology

**Agent**: architect

Build a complete picture of the existing feature before changing anything.

## Phase 2: Change Impact Analysis

**Agent**: architect

Assess blast radius.
- Classify change type: **behavioral** (user-visible), **structural** (internal refactor), or **both**
- List every file that will be modified
- List breakage candidates: files/features that depend on code being changed
- Rate overall risk: **Low** / **Medium** / **High**
- If High risk: produce an Architecture Decision Record (ADR) explaining the change rationale and alternatives considered
- Output: **Impact Assessment**

## Phase 3: Safe Implementation

**Agent**: dev

Implement the improvement using TDD with regression protection.

## Phase 4: Regression Review

**Agent**: lead-dev

Verify the implementation is safe and minimal.
- Confirm minimal-change principle: no unrelated edits, no scope creep
- Check every file listed as a breakage candidate in the Impact Assessment
- Verify that preserved/modified/removed behaviors match the Improvement Spec exactly
- Review naming conventions, code patterns, and consistency with existing codebase
- Output: `[APPROVE]` or `[VETO]` with specific, actionable feedback

## Phase 5: E2E Validation

**Agent**: qa

Validate end-to-end with no regressions.
- Run the existing E2E test suite from `tests/e2e/` — all must pass (no regressions)
- Write or update E2E tests for **modified** behaviors (assert new expected behavior)
- Write E2E tests for any **new** behaviors introduced by the improvement
- Remove or update E2E tests for **removed** behaviors
- Update `tests/e2e/README.md` if test inventory changed
- Full E2E run — all tests must pass

## Phase 6: Changelog & Documentation

**Agent**: dev

Create an atomic git commit.
- Format: `improve: <concise description of the improvement>`
- Stage only changed files (no unrelated files)
- Commit message body must include a **Behavior Changes** section:
  - **preserved**: list behaviors confirmed unchanged
  - **modified**: list before → after for each changed behavior
  - **removed**: list dropped behaviors with rationale