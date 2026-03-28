# Factory UI V2 — Specification Index

This folder contains the complete feature specifications for Factory UI V2.

## Reading Order

| File | Domain | Scope |
|---|---|---|
| [01-project-management.md](01-project-management.md) | Project | Registry, CRUD, projects browser, create project, file API |
| [02-project-ide.md](02-project-ide.md) | Project | Main IDE page — run navigator, terminal, editor, launch, branches |
| [03-run-execution.md](03-run-execution.md) | Run | Launch panel, PTY, WebSocket, process lifecycle, awaiting_input |
| [04-run-history.md](04-run-history.md) | Run | History page, terminal viewer, session resume |
| [05-library-browser.md](05-library-browser.md) | Library | Item browser, search, filter, tags, item detail, copy to project |
| [06-library-import.md](06-library-import.md) | Library | Claude folder scanner, import wizard |
| [07-git-panel.md](07-git-panel.md) | Git | Diff viewer, stage, commit, branch — inside project IDE |
| [08-worktrees.md](08-worktrees.md) | Git | Git worktree create/delete/switch |
| [09-github-integration.md](09-github-integration.md) | GitHub | Repo linking, push, PR creation |
| [10-cockpit.md](10-cockpit.md) | Shell | Dashboard — active runs, recent projects, recent runs |
| [11-settings.md](11-settings.md) | System | Global settings — GitHub token, model, pricing |
| [12-code-review.md](12-code-review.md) | Code Review | Dependency graph, blast radius, impact analysis |
| [13-app-shell.md](13-app-shell.md) | Shell | Sidebar, mobile nav, search, toasts, keyboard shortcuts |
| [14-devops-init.md](14-devops-init.md) | Infrastructure | Project scaffolding, CI, Docker, scripts, dev setup (Sprint 0) |

## Architecture Overview

See [v2-architecture.md](v2-architecture.md) for the system architecture and component interaction map.
See [v2-launch-panel-ux.md](v2-launch-panel-ux.md) for the launch panel UX detail (command input, autocomplete, controls).

## Suggested Sprint Sequence

| Sprint | Files | Outcome |
|---|---|---|
| 0 — DevOps Init | 14 | Repo scaffolding, CI, Docker, startup scripts, dev environment |
| 1 — Foundation | 01, 11, 13 | Projects browser, create, delete. App shell + nav. Settings. |
| 2 — Project IDE Shell | 02, 10 | IDE layout, run navigator, file tree, editor. Cockpit. |
| 3 — Run Execution | 03 + launch panel UX | Command input, PTY, WebSocket, terminal, awaiting_input |
| 4 — Library | 05 + 06 | Library browser + import wizard + copy to project |
| 5 — Git | 07 + 08 | Git panel diff/commit + worktrees |
| 6 — Run History | 04 | History table, terminal replay, resume |
| 7 — GitHub | 09 | Repo linking, push, PR creation |
| 8 — Code Review | 12 | ReactFlow dependency graph, blast radius |
| 9 — Polish | all | Mobile, empty states, error handling, edge cases |

## Design System

All UI must follow `DESIGN.md` (at project root). Key tokens:
- Background: `#10161f` -- Surface: `#192030` -- Border: `#263245`
- Primary accent: `#4195e8` (sapphire) — active state, CTAs
- Running state: `#5ecf3a` (lime green) — live/active runs only
- Awaiting input: `#f59e0b` (amber) — pulsing, needs attention
- Text: `#dce8f5` -- Muted: `#8299b8`
- Font: DM Sans for UI, DM Mono for code/data
