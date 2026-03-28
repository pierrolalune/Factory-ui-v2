# TDD Cycle Workflow

Strict Red-Green-Refactor cycle for implementing a feature or fixing a bug.

## Phase 1: Red — Write Failing Tests

Write tests that define the expected behavior.
- Read the task/user story and acceptance criteria
- Write focused tests using Arrange-Act-Assert pattern
- One logical assertion per test
- Cover happy path + error cases + edge cases
- Run tests — they MUST fail (red)
- If any test passes, the test is wrong — fix the test

## Phase 2: Green — Minimal Implementation

Write the smallest code that makes all tests pass.
- Implement minimum code to pass each test
- No premature abstractions or "while I'm here" changes
- No code beyond what the tests require
- Run tests after each change
- Loop until ALL tests are green

## Phase 3: Refactor

Clean up the implementation without changing behavior.
- Remove duplication
- Extract constants and improve naming
- Simplify complex logic
- Run ALL tests after every change — nothing must break
- If refactoring is complex, do it in small atomic steps

## Phase 4: Review

Review the TDD implementation.
- Verify tests were written before implementation
- Check code quality and naming conventions
- Verify no over-engineering or dead code
- Confirm test coverage is adequate
- Output: [APPROVE] or [VETO] with specific feedback