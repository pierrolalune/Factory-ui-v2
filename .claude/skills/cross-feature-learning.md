# Cross-Feature Learning

Extracts reusable patterns from factory execution history and injects them as context for future features. Runs after every feature ships or is skipped.

## When to Run

- **After Phase 10 (Ship)**: Extract success patterns
- **After any skip**: Extract failure patterns
- **At feature start (Phase 3)**: Inject relevant lessons as context

## Extraction Process

After a feature completes (shipped or skipped):

1. Read the feature's execution data from factory state:
   - Phase timings (which phases were slow?)
   - Revision history (what was revised, how many rounds?)
   - Final User report (which dimensions scored low? which weaknesses recurred?)
   - Skip reason (if skipped)
   - Tier classification (was it correctly classified?)

2. Compare against existing learnings in `.claude/state/factory-learnings.json`

3. Extract a pattern ONLY if it meets the **3-occurrence threshold**:
   - Same type of weakness flagged in 3+ features -> pattern
   - Same phase causing skips in 3+ features -> pattern
   - Same revision type (REFINE vs PIVOT) succeeding in 3+ features -> pattern
   - Do NOT extract patterns from fewer than 3 occurrences (avoid false signals)

4. Write the learning to `.claude/state/factory-learnings.json`

## Learning Schema

```json
{
  "learnings": [
    {
      "id": "L-001",
      "category": "skip-pattern|revision-pattern|timing-pattern|success-pattern|tier-pattern",
      "lesson": "One-line actionable lesson",
      "detail": "What was observed and why it matters",
      "applicable_agents": ["dev", "qa-tester"],
      "occurrences": 3,
      "feature_ids": ["FP-001", "FP-003", "FP-007"],
      "created_at": "ISO-8601",
      "last_seen": "ISO-8601"
    }
  ],
  "pending_observations": [
    {
      "type": "weakness|skip|timing|success",
      "observation": "What was observed",
      "feature_id": "FP-002",
      "timestamp": "ISO-8601"
    }
  ]
}
```

The `pending_observations` array accumulates single occurrences that haven't yet reached the 3-occurrence threshold. Once 3 similar observations cluster, they graduate to a `learning`.

## Injection Process

At the start of each new feature (after triage, before spec):

1. Read `.claude/state/factory-learnings.json`
2. Filter learnings relevant to the current feature:
   - Match by `applicable_agents` (include learnings for agents that will run)
   - Match by `category` (e.g., if previous features had "missing empty states" weakness, inject that as a reminder for Dev)
3. Format as a brief context block (max 5 learnings, most recent first):
   ```
   ## Lessons from Previous Features
   - L-001: Always add empty/loading/error states for new UI components (seen in FP-001, FP-003, FP-007)
   - L-005: Security agent consistently flags unvalidated user input in API routes (seen in FP-002, FP-004, FP-008)
   ```
4. Include this context block in the prompts for Dev, QA, and UX agents

## Maintenance

- **Cap**: Maximum 50 learnings. When exceeding, prune the oldest learnings (by `last_seen`) that haven't been seen in the last 10 features.
- **Staleness**: If a learning hasn't been triggered in 20 features, mark it as stale and exclude from injection.
- **Contradiction**: If a new pattern contradicts an existing learning, replace the old one.
