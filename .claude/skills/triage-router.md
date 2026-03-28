# Triage Router

Classifies features by complexity to route them through the appropriate pipeline tier. Runs after seed ingestion, before any agent work begins.

## Classification Tiers

### PATCH (Lightweight Pipeline)

Single-file changes with no architectural impact.

**Signals** (any match -> PATCH candidate):
- Seed text mentions: "color", "copy", "text", "typo", "label", "wording", "padding", "margin", "font", "icon swap", "config", "env var", "toggle", "rename"
- Estimated file count: 1 (max 2 including test file)
- No new API endpoints, no database changes, no new dependencies, no auth changes

**Pipeline**: Dev (TDD, max 2 iterations) -> Lead Dev (review) -> Security (quick scan) -> Ship.
**Skipped phases**: Feature Spec, Architecture Lock, Sprint Contract, UX Polish, Documentation, Final User.

### MINOR (Standard Pipeline)

Multi-file changes within existing architecture. No schema migrations or new external integrations.

**Signals** (no PATCH signals, no MAJOR signals):
- Estimated file count: 2-10
- Changes stay within existing patterns (new component using existing design system, new API route using existing middleware)
- No database migration, no new auth flow, no new external service integration

**Pipeline**: Full pipeline with optimizations:
- Skip Sprint Contract Negotiation (Dev proceeds directly with Implementation Contract only)
- TDD Sprint: max 3 iterations (instead of 6)
- Skip UX Polish if no frontend files changed
- Final User evaluation uses Sonnet model (if dynamic model routing enabled)

### MAJOR (Full Pipeline)

Architectural changes, new integrations, or high-risk modifications.

**Signals** (any match -> MAJOR):
- Seed text mentions: "migration", "schema", "auth", "authentication", "authorization", "OAuth", "SSO", "payment", "billing", "external API", "third-party", "webhook", "real-time", "WebSocket", "queue", "worker", "cron"
- Estimated file count: 10+
- New database tables or column modifications
- New external service dependency
- Changes to authentication or authorization logic
- Performance-critical path modifications

**Pipeline**: Full pipeline, all phases, all agents. No shortcuts.

## Classification Process

1. Read the feature seed text and any existing spec
2. Scan for MAJOR signals first (if any match -> MAJOR)
3. Scan for PATCH signals (if match AND estimated files <= 2 -> PATCH)
4. Default to MINOR for everything else
5. Output classification:
   ```json
   {
     "tier": "PATCH|MINOR|MAJOR",
     "rationale": "Brief explanation of classification",
     "signals_matched": ["list of matched signals"],
     "estimated_files": 0,
     "pipeline_skips": ["list of phases to skip"]
   }
   ```

## Tier Escalation

The Lead Dev review (present in ALL tiers) can escalate the tier upward:
- If Lead Dev discovers the change has more blast radius than the triage indicated, they annotate `[ESCALATE: MINOR]` or `[ESCALATE: MAJOR]`
- The workflow re-runs remaining phases according to the escalated tier
- Escalation never goes downward (MAJOR -> MINOR is not allowed)

Security runs in ALL tiers. It is cheap, fast, and non-negotiable.

## State Integration

Store the tier in the feature state:
```json
{
  "current_feature": {
    "tier": "PATCH|MINOR|MAJOR",
    "tier_rationale": "...",
    "tier_escalated_from": null
  }
}
```
