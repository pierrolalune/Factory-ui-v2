# Spec 10 — Cockpit

**Domain**: Shell
**Route**: `/`
**Sprint**: 2

---

## Overview

The Cockpit is the landing page of Factory UI. It shows what is happening now (active runs) and what happened recently (projects, runs). No analytics charts. No workspace board. Just current state and recent activity.

---

## Tech Stack

- **Frontend**: Next.js 15, TanStack Query
- **Data**: Reuses existing endpoints (`GET /api/runs`, `GET /api/projects`)

---

## Page Layout

### Desktop

```
+----------------------------------------------------------------------+
| Sidebar |  Cockpit                                                    |
|         +------------------------------------------------------------+
|         |                                                            |
|         |  -- Active Runs ------------------------------------------ |
|         |  ! /retro    My App  main        1:12  $0.12               |
|         |    ! Waiting for your input                                |
|         |  * /polisher  My App  feat/login  0:42  $0.06              |
|         |    > Writing: src/auth.ts                                  |
|         |  * /feature-spec  Factory  main   2:01  $0.18              |
|         |    > Thinking...                                           |
|         |                                                            |
|         |  -- Recent Projects (5) ----------- [View all projects ->] |
|         |  +----------+  +----------+  +----------+                  |
|         |  | My App   |  | Factory  |  | Blog     |                  |
|         |  | 2h ago   |  | * Running|  | Never    |                  |
|         |  +----------+  +----------+  +----------+                  |
|         |                                                            |
|         |  -- Recent Runs (10) --------------- [View all runs ->]    |
|         |  +------+----------+--------+------+------+------+         |
|         |  | Proj | Run      | Branch |Status| Time | Cost |         |
|         |  | My App| /polisher| main  |  ok  | 32s  |$0.04 |         |
|         |  | Blog | /feature | feat/x| fail | 1m   |$0.07 |         |
|         |  +------+----------+--------+------+------+------+         |
|         |                                                            |
+----------------------------------------------------------------------+
```

### Mobile (< 640px)

Same sections stacked vertically. Project cards: 1 column. Recent runs table: simplified (no branch column, truncated prompt).

---

## Sections

### Active Runs

Shows all runs with status `active` or `awaiting_input`.

**Sort order**: `awaiting_input` runs first (they need attention), then `active` runs, all sorted by `started_at` descending.

**Each row**:
- Command stem (e.g. `/polisher`) or "Raw Terminal" for raw runs
- Project name
- Branch name
- Elapsed time (live counter, updates every second)
- Cost (live, from WebSocket cost_update)
- Phase line below: current tool use (e.g. "Writing: src/auth.ts") or "Waiting for your input" (amber) or "Thinking..."

**Interactions**:
- Click a row: navigate to `/projects/{project_id}` with `?focusRun={run_id}` — the project IDE opens and focuses that run's terminal

**Empty state**: "No active runs." (muted text)

**Data source**: `GET /api/runs?status=active` polled every 2s via TanStack Query.

---

### Recent Projects

Last 5 projects sorted by `last_run_at` (most recent first). Projects that have never been run sort to the end.

**Each card**:
- Project name (large text, `#dce8f5`)
- Truncated path (muted, `#8299b8`)
- Status line:
  - `* Running` — lime green, if any active run exists for this project
  - `2h ago` — time since last run completion
  - `Never run` — muted, if no runs exist

**Interactions**:
- Click a card: navigate to `/projects/{id}`

**[View all projects ->]**: link to `/projects`

**Grid**: 3 columns on xl, 2 on md, 1 on mobile.

**Data source**: `GET /api/projects` with TanStack Query, refetch every 10s.

---

### Recent Runs

Last 10 completed, failed, or cancelled runs across all projects.

**Table columns**:

| Column | Content |
|---|---|
| Project | Project name (linked to `/projects/{id}`) |
| Run | Command stem + truncated args, or prompt preview for raw runs. Click: navigate to `/runs/{run_id}` |
| Branch | Branch name or "main" |
| Status | Icon: check (completed, green), X (failed, red), ban (cancelled, grey) |
| Duration | "32s", "4m 12s", "2h 03m" |
| Cost | "$0.04" or "-" if unavailable |

**[View all runs ->]**: link to `/runs`

**Data source**: `GET /api/runs?limit=10&sort=started_at_desc` with TanStack Query, refetch every 5s.

---

## States

| State | Display |
|---|---|
| Loading | Skeleton sections (3 skeleton cards, 5 skeleton table rows) |
| No projects | "Welcome to Factory UI. Add your first project to get started." with CTA button linking to `/projects/new` |
| No active runs | Active runs section hidden entirely |
| No completed runs | Recent runs section shows "No runs yet. Launch your first run from a project." |

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `CockpitPage` | `app/(app)/page.tsx` | Layout orchestrator |
| `ActiveRunsSection` | `components/cockpit/ActiveRunsSection.tsx` | Live active runs list with phase lines |
| `RecentProjectsSection` | `components/cockpit/RecentProjectsSection.tsx` | Project cards grid |
| `ProjectCard` | `components/cockpit/ProjectCard.tsx` | Name, path, run status |
| `RecentRunsSection` | `components/cockpit/RecentRunsSection.tsx` | Completed runs table |

**TanStack Query hooks** (reuse from other specs):
- `useProjects()` — GET /api/projects
- `useRuns({ status: "active" })` — for active runs
- `useRuns({ limit: 10 })` — for recent runs

---

## Acceptance Criteria

**Active Runs**
- Given runs are active, Then they appear at the top of the cockpit with live elapsed time and phase
- Given a run is `awaiting_input`, Then it shows with amber "Waiting for your input" text and sorts above other active runs
- Given I click an active run row, Then I navigate to the project IDE with that run's terminal focused
- Given no runs are active, Then the active runs section is hidden

**Recent Projects**
- Given projects exist, Then the last 5 (by last run time) are shown as cards
- Given a project has an active run, Then its card shows "Running" with a lime indicator
- Given I click a project card, Then I navigate to `/projects/{id}`

**Recent Runs**
- Given completed runs exist, Then the last 10 are shown in a table with project, command, branch, status, duration, cost
- Given I click a run row, Then I navigate to `/runs/{run_id}`

**Empty States**
- Given no projects exist, Then a welcome message with "Add your first project" CTA is shown
- Given no runs exist, Then "No runs yet" is shown

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| CockpitPage layout + responsive | S |
| ActiveRunsSection (live polling, awaiting_input sort, phase lines) | M |
| RecentProjectsSection + ProjectCard (grid, status) | M |
| RecentRunsSection (table, status badges, linked navigation) | M |
