# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Tech Stack

{{TECH_STACK}}

## Project Structure

```
{{PROJECT_STRUCTURE}}
```

## Harness Reference

This project uses the Feature Factory harness (`.claude/`).

### Directory Layout

| Path | Contents |
|------|----------|
| `.claude/agents/` | 15 agent personas (dev, lead-dev, architect, security, qa-tester, final-user, etc.) |
| `.claude/commands/` | Command entry points (user-facing slash commands) |
| `.claude/skills/` | Reusable skill definitions (behavioral patterns, domain knowledge) |
| `.claude/skills/workflows/` | Multi-agent workflow orchestrations |
| `.claude/skills/optional/` | Project-dependent skills (regulatory, compliance) -- load only if relevant |
| `.claude/state/` | Pipeline state files (factory-seeds.md, feature-backlog.json, etc.) |

### Veto Hierarchy

1. **ABSOLUTE** (Security): SQL injection, exposed secrets, broken auth, command injection -- pipeline halts, no retry
2. **STRONG** (Lead Dev, Final User, Architect, CEO-Founder): Quality, TDD compliance, design flaws -- max 2 retries then skip
3. **BLOCKING** (UX Designer): WCAG violations, missing component states -- must fix before Final User review
4. **Advisory** (all others): Informational, no blocking power

### Model Routing

- **Opus**: Judgment roles requiring deep reasoning (ceo-founder, final-user, lead-dev, vision-facilitator)
- **Sonnet**: Execution and focused tasks (dev, architect, security, qa-tester, ux-designer, devops, sre, tech-writer, product-manager, business-analyst, engineering-manager)

### Key Rules

- TDD always: tests before implementation, no exceptions
- 80% minimum code coverage on new code
- Functions max 30 lines
- No `any` in TypeScript, no `.unwrap()` in Rust
- No hardcoded secrets, URLs, or config values
- Comments explain WHY, never WHAT

### Quick Commands

| Command | Use Case |
|---------|----------|
| `/factory` | Fully autonomous continuous feature delivery |
| `/idea-to-feature` | Turn one idea into a shipped feature (human gates) |
| `/idea-to-app` | Build a complete app from scratch |
| `/improve-loop` | Iterative improvement cycles on existing feature |
| `/quality-gate` | Pre-merge quality check (report-only) |
| `/vision` | Interactive brainstorming with Vision Facilitator |
| `/tdd-cycle` | Strict Red-Green-Refactor for a single feature/bug |

### State Files

| File | Purpose |
|------|---------|
| `.claude/state/factory-seeds.md` | User feature ideas queue (editable anytime) |
| `.claude/state/feature-backlog.json` | WSJF-prioritized feature backlog |
| `.claude/state/factory-state.json` | Current pipeline execution state |

## Project Conventions

{{PROJECT_CONVENTIONS}}

## Development Notes

{{DEVELOPMENT_NOTES}}
