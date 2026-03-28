# Factory UI V2

A local-first desktop/mobile web app for running Claude Code commands against multiple projects, reviewing changes, and managing a library of reusable `.claude/` items. Single-user, no auth. Runs on Windows (primary), accessible from phone over local WiFi.

## Tech Stack

**Backend**: Python 3.11+, FastAPI 0.115+, Pydantic 2, uvicorn, httpx, pywinpty (Windows ConPTY), websockets
**Frontend**: Next.js 15 (App Router), React 19, TypeScript 5 (strict), Tailwind CSS 4, Zustand, TanStack Query 5, react-hook-form, zod/v4, xterm.js, @xyflow/react, dagre, CodeMirror 6, lucide-react
**Package manager**: pnpm 9+
**Linting**: Ruff (backend), ESLint 9 flat config (frontend)
**Testing**: pytest 8+ (backend), Playwright 1.50+ (E2E)
**CI**: GitHub Actions (lint + test on push/PR)

## Project Structure

```
backend/
    main.py                       # FastAPI app, CORS, lifespan, router mounts
    routers/                      # 10 routers: projects, run, runs, library, claude_import,
                                  #   code_review, git, worktrees, github, settings
    services/                     # 14 services: process_manager, pty_backend, project_service,
                                  #   run_history_service, run_output_service, library_service,
                                  #   claude_folder_scanner, claude_session_service, claude_cli,
                                  #   git_service, worktree_service, github_service,
                                  #   code_review_service, settings_service
    schemas/                      # Pydantic models: project, run, library, worktree,
                                  #   code_review, settings
    tests/                        # pytest: conftest.py + test_*.py
frontend/
    src/
        app/(app)/                # 9 routes: cockpit, projects, project IDE, review,
                                  #   runs, run viewer, library, settings
        components/               # ~55 components in: shell/, cockpit/, project/, terminal/,
                                  #   library/, runs/, code-review/, settings/
        hooks/                    # Custom hooks (useProjectCommands, useRunWebSocket, etc.)
        store/                    # Zustand stores
        lib/
            api/                  # API client + Zod schemas (snake_case → camelCase)
            constants.ts
            utils/
    e2e/                          # Playwright smoke tests
ClaudeLibrairy/                   # Library storage (flat items + tags)
    _index.json                   # Item summaries
    items/                        # Full items as {id}.json
Docs/                             # 14 feature specs + architecture + launch panel UX
DESIGN.md                         # Complete design system (colors, typography, spacing, components)
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

### Backend (Python)

- Run from project root, never from inside `backend/`: `py -m uvicorn backend.main:app --reload --port 8000`
- All endpoints under `/api/` prefix, WebSocket at `/ws/run/{run_id}`
- JSON responses use `snake_case` keys
- Error format: `{ "detail": "message", "code": "error_code" }` with HTTP 400/404/409/500
- No auth — single-user local tool, no JWT/cookies
- CORS auto-detects localhost + LAN IPs on port 3000
- Ruff for linting: `ruff check backend/`, line length 120
- Pydantic V2 models in `backend/schemas/`
- Logging to `logs/backend.log` (RotatingFileHandler, 5MB, 3 backups)

### Frontend (TypeScript/React)

- pnpm as package manager, `cd frontend && pnpm install && pnpm dev`
- TypeScript strict mode, no `any`
- Zod v4 schemas convert API `snake_case` to frontend `camelCase`: `import { z } from "zod/v4"`
- Path alias: `@/*` maps to `./src/*`
- Zustand for UI state, TanStack Query for server state + caching
- react-hook-form + zod for form management
- Lucide React for all icons (see DESIGN.md for icon mapping)
- Prettier: no semicolons, double quotes, trailing commas, 100 char width

### Design System (DESIGN.md)

All UI must follow DESIGN.md. Key tokens:
- Backgrounds: `#10161f` (body) → `#192030` (surface) → `#1f2a3e` (elevated) → `#263245` (border)
- Text: `#dce8f5` (primary) → `#a8bdd4` (secondary) → `#8299b8` (muted) → `#607896` (faint)
- Primary accent: `#4195e8` (sapphire) — buttons, CTAs, focus rings, links
- Running state: `#5ecf3a` (lime) — ONLY for live/active run indicators
- Awaiting input: `#f59e0b` (amber) — pulsing badge for runs needing attention
- Fonts: DM Sans (UI), DM Mono (code/terminal/data)
- Spacing: 8px base, all multiples of 4px
- Border radius: 4px (badges) → 8px (buttons/inputs) → 12px (cards) → 16px (modals)

### Git & Branching

- `main` — stable, deployable
- `feat/{name}` — feature branches
- `fix/{name}` — bug fixes
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`

### API Patterns

- Frontend auto-detects backend URL from `window.location.hostname` (supports LAN access)
- WebSocket reconnection: exponential backoff (1s, 2s, 4s, 8s, 16s), max 5 attempts, replay last ~500KB on reconnect
- TanStack Query handles retries with exponential backoff (3 attempts, 1s/2s/4s)
- Error boundaries per-page catch render errors

### Storage (filesystem, no database)

```
~/.factory-cli.json              # Global settings
~/.factory-cli-projects.json     # Project registry (flat JSON array)
~/.factory-projects/{id}/        # Per-project data: config, worktrees, runs
ClaudeLibrairy/_index.json       # Library item summaries
ClaudeLibrairy/items/{id}.json   # Full library items with content
```

## Development Notes

### Running Locally

```bash
# Backend (from project root)
py -m uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && pnpm dev

# LAN mode (mobile access)
py -m uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0
cd frontend && pnpm dev --hostname 0.0.0.0

# Or use startup scripts
./start.ps1          # Windows localhost
./start-lan.ps1      # Windows LAN mode
./start.sh           # Bash (macOS/Linux/WSL)
```

### Testing

```bash
# Backend
pytest backend/tests/ -v

# Frontend lint + typecheck
cd frontend && pnpm lint && pnpm typecheck

# E2E (run locally, not in CI — needs Claude CLI)
cd frontend && pnpm test
```

### Sprint Sequence

| Sprint | Specs | Outcome |
|--------|-------|---------|
| 0 | 14 | Repo scaffolding, CI, Docker, startup scripts |
| 1 | 01, 11, 13 | Projects browser, settings, app shell + nav |
| 2 | 02, 10 | Project IDE layout, run navigator, cockpit |
| 3 | 03 + launch panel UX | Command input, PTY, WebSocket, terminal |
| 4 | 05, 06 | Library browser + import wizard |
| 5 | 07, 08 | Git panel + worktrees |
| 6 | 04 | Run history, terminal replay, resume |
| 7 | 09 | GitHub integration (push, PRs) |
| 8 | 12 | Code review dependency graph (ReactFlow) |
| 9 | all | Mobile polish, empty states, error handling |

### Key Architecture Decisions

- **Commands must be installed before launching.** Commands must exist in `project/.claude/` before launching. The library's "Copy to project" action installs items into the project.
- **`awaiting_input` is a first-class run state.** When Claude pauses for permission/input, the run enters `awaiting_input` status with amber pulsing indicator, sorted to top of Run Navigator.
- **Library uses flat items + tags.** Search + tag filter is the navigation.
- **Two run types**: Command (`/stem args`) and Raw (interactive Claude session).
- **ConPTY on Windows**: PTY output may have CR+LF line wrapping at column 120 inside JSON — parser must reassemble wrapped lines before `json.loads()`.

### Specification Documents

All feature specs are in `Docs/` (numbered 01–14). Architecture in `Docs/v2-architecture.md`. Launch panel UX in `Docs/v2-launch-panel-ux.md`. Read the relevant spec before implementing a feature.
