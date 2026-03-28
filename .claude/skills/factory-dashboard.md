# Factory Dashboard

Generates a human-readable dashboard from factory state files. Surfaces metrics, trends, bottlenecks, and alerts that are otherwise buried in JSON.

## When to Run

- After every 3rd shipped feature (auto-triggered by factory workflow)
- On explicit request via `/dashboard` command
- After `/retro` for additional context

## Data Sources

Read all available state files:
- `.claude/state/factory-state.json` -- pipeline status, current feature, metrics
- `.claude/state/feature-backlog.json` -- backlog status, queued/shipped/skipped counts
- `.claude/state/factory-seeds.md` -- seed queue status
- `.claude/state/final-user-reports.json` -- evaluation scores and trends
- `.claude/state/factory-learnings.json` -- active learnings and pending observations

## Dashboard Output

Write to `Docs/reports/factory-dashboard.md` (overwritten each run).

### Template

```markdown
# Factory Dashboard
Generated: {ISO-8601}

## Pipeline Status
- **Status**: {running|idle|blocked|waiting_for_backlog}
- **Current iteration**: {N}
- **Current feature**: {FP-NNN: name} (Phase {N}: {phase_name})

## Feature Counts
- Shipped: {N} (avg score: {N}/100)
- Skipped: {N} ({breakdown by reason})
- In progress: {N}
- Queued: {N} ({N} user seeds, {N} auto-discovered)
- Ship rate: {shipped / (shipped + skipped)}%

## Score Trend (last 5 shipped features)
{FP-001}: {score}/100
{FP-002}: {score}/100
...
Trend: {rising|stable|declining} (avg delta: {+/-N})

## Phase Timing (avg seconds)
| Phase | Avg Duration | % of Total | Trend |
|-------|-------------|------------|-------|
| Triage | {N}s | {N}% | {arrow} |
| Feature Spec | {N}s | {N}% | {arrow} |
| ...
**Bottleneck**: {phase_name} ({N}% of total pipeline time)

## Skip Analysis
| Reason | Count | Last Seen |
|--------|-------|-----------|
| {reason} | {N} | {FP-NNN} |

## Active Learnings
- {L-001}: {lesson} (seen {N} times)
- ...

## Alerts
- {WARN|INFO}: {description}
```

### Alert Rules

Generate alerts when:
- **WARN**: Any phase's avg duration increased >40% over the last 3 features
- **WARN**: Ship rate dropped below 60%
- **WARN**: Final User score trend is declining (3+ consecutive decreases)
- **WARN**: Same skip reason occurred 3+ times
- **INFO**: Final User score variance is low (std dev < 5) -- evaluation is consistent
- **INFO**: A learning graduated from pending to active
- **INFO**: Tier distribution summary (e.g., "80% MINOR, 15% PATCH, 5% MAJOR")
