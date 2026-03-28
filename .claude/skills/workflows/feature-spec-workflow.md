# Feature Spec Workflow

Takes a single user-provided feature idea and produces a complete, ready-to-implement spec: user story, acceptance criteria, UX flow, technical design, and FP file.

## Phase 1: Feature Clarification

Understand and reframe the feature.
- Identify the target persona (who benefits?)
- Extract the core problem being solved (apply 5 Whys if needed)
- Check the codebase for any existing partial implementation — if the feature already exists in full, stop and report
- Write a canonical **Feature Brief**:
  - Feature name (short, noun-phrase)
  - Persona
  - Problem statement (one sentence)
  - Proposed solution (one paragraph)
  - Out-of-scope items (what this feature is NOT)
- Output: Feature Brief

## Phase 2: Technical Design

Design the system-level approach.
- Identify which existing modules, services, or APIs are involved
- Specify any new modules, routes, or data models required
- Describe data flow: what enters, what is stored/transformed, what is returned
- Flag any architectural constraints or risks
- Output: **Technical Design** (affected files, new components, data flow diagram in text)

## Phase 3: UX Flow Design

Design the user-facing experience.
- Map the full user flow (step-by-step: entry point → action → feedback → exit)
- Describe each screen or UI state involved (new or modified)
- Specify empty states, loading states, and error states
- Note any keyboard shortcuts, accessibility requirements, or responsive considerations
- Output: **UX Flow Document** (text-based flow diagram + screen descriptions)

## Phase 4: Spec Review

Challenge the spec for completeness and testability.
- Is every acceptance criterion testable (Given/When/Then)?
- Are edge cases and error paths covered?
- Are there missing states (empty, loading, error, permission denied)?
- Output: `[APPROVE]` or `[VETO]` with specific gaps listed

## Phase 5: Spec File & FP Creation

Write and file the complete spec.