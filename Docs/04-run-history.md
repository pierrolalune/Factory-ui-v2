# Spec 04 — Run History

**Domain**: Run
**Routes**: `/runs`, `/runs/[run_id]`
**Sprint**: 6

---

## Overview

Run History lets the user browse all past runs across all projects, inspect their terminal output, and resume sessions from past runs. It is the audit trail and recovery surface for Claude Code executions.

This spec covers:
- The `/runs` history page (cross-project list)
- The `/runs/[run_id]` terminal viewer (replay + metadata)
- Session resume from history
- Run storage format

---

## Tech Stack

- **Storage**: `~/.factory-projects/{project_id}/runs/` — one JSON file per run
- **Output buffer**: `~/.factory-projects/{project_id}/runs/{run_id}.output` — raw PTY bytes (gzipped), capped at 2MB
- **Frontend**: Next.js 15, TanStack Query, xterm.js for replay

---

## Data Model

### RunStatus

```typescript
type RunStatus = "pending" | "active" | "awaiting_input" | "completed" | "failed" | "cancelled"
```

### Run (full — see also `03-run-execution.md`)

```typescript
interface Run {
  run_id: string
  type: "command" | "raw" | "resume"
  status: RunStatus
  exit_code?: number

  project_id: string
  project_name: string

  command_stem?: string    // e.g. "polisher" — present for type="command"
  command_args?: string    // e.g. "src/components/" — free-form args string

  prompt: string
  branch?: string
  worktree_path?: string   // absolute path if run targets a worktree
  effort?: string
  skip_permissions: boolean
  awaiting_input: boolean  // true when the process is blocked waiting for user input

  started_at: string
  ended_at?: string
  duration_ms?: number

  claude_session_id?: string
  session_name?: string

  total_cost_usd?: number
  input_tokens?: number
  output_tokens?: number
  num_turns?: number

  error_message?: string
}
```

### RunListItem (lightweight — for the history table)

```typescript
interface RunListItem {
  run_id: string
  type: "command" | "raw" | "resume"
  status: RunStatus
  project_id: string
  project_name: string
  command_stem?: string    // e.g. "polisher"
  command_args?: string    // e.g. "src/components/"
  prompt_preview: string   // command_stem if type="command", "Raw Claude Terminal" if type="raw", first 80 chars of prompt for type="resume"
  branch?: string
  worktree_path?: string
  started_at: string
  duration_ms?: number
  total_cost_usd?: number
  session_name?: string
  claude_session_id?: string
}
```

`prompt_preview` rules:
- `type === "command"`: show `/{command_stem} {command_args}` (truncated at 80 chars)
- `type === "raw"`: show `"Raw Claude Terminal"`
- `type === "resume"`: show first 80 chars of `prompt`

---

## API Endpoints

### `GET /api/runs`
List runs with filtering.

**Query params**:
| Param | Type | Default | Description |
|---|---|---|---|
| `project_id` | string | — | Filter to one project |
| `status` | string | — | Filter by status: `active`, `awaiting_input`, `completed`, `failed`, `cancelled` |
| `limit` | int | 50 | Max results |
| `offset` | int | 0 | Pagination offset |
| `sort` | string | `started_at_desc` | Sort order |

**Response**:
```json
{
  "runs": [ RunListItem ],
  "total": 142,
  "has_more": true
}
```

---

### `GET /api/runs/{run_id}`
Get full run details.

**Response**: `Run`

---

### `GET /api/runs/{run_id}/output`
Stream the stored PTY output for a completed run.

**Response**: Raw bytes (PTY output, suitable for xterm.js replay)

Used for terminal replay in `/runs/[run_id]`.

---

### `DELETE /api/runs/{run_id}`
Delete a run and its output buffer.

**Response**: `{ "ok": true }`

---

## Pages

### `/runs` — Run History

**Purpose**: Cross-project log of all runs. Filter, search, resume past sessions.

**Layout**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Run History                                                    │
│         ├─────────────────────────────────────────────────────────────── │
│         │  [All Projects ▾]  [All Status ▾]          Search...           │
│         ├───────┬──────────────┬──────────┬────────┬──────────┬────────  │
│         │ Project │ Run        │ Branch   │ Status │ Duration │ Cost     │
│         ├───────┼──────────────┼──────────┼────────┼──────────┼────────  │
│         │ My App │ cmd         │ main     │ ✓      │ 32s      │ $0.04    │
│         │        │ /polisher   │          │        │          │  [↻]     │
│         │        │  src/comp.. │          │        │          │          │
│         ├───────┼──────────────┼──────────┼────────┼──────────┼────────  │
│         │ My App │ raw         │ main     │ ✓      │ 4m 12s   │ $0.18    │
│         │        │ Raw Claude  │          │        │          │  [↻]     │
│         │        │  Terminal   │          │        │          │          │
│         ├───────┼──────────────┼──────────┼────────┼──────────┼────────  │
│         │ Blog   │ cmd         │ feat/    │ ✗      │ 1m 03s   │ $0.07    │
│         │        │ /feature-   │ login    │        │          │  [↻]     │
│         │        │  spec login │          │        │          │          │
│         └───────┴──────────────┴──────────┴────────┴──────────┴────────  │
│         │  Load more                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Table columns**:
| Column | Content |
|---|---|
| Project | Project name (linked to /projects/{id}) |
| Run | Type badge (`cmd` / `raw` / `resume`) + prompt_preview. Click → /runs/{id} |
| Branch | Branch name or "main" |
| Status | Icon + color: ✓ green (completed), ✗ red (failed), ⊘ grey (cancelled), ● live green (active), ◑ amber pulsing (awaiting_input) |
| Duration | "32s", "4m 12s", "2h 03m" |
| Cost | "$0.04" or "—" if unavailable |
| Actions | `[↻]` resume button (only if `claude_session_id` present) |

**Type badges**:
- `cmd` — sapphire (`#4195e8`)
- `raw` — muted teal
- `resume` — muted purple

**Filters**:
- **Project dropdown**: "All Projects" or pick one
- **Status dropdown**: All / Active / Awaiting Input / Completed / Failed / Cancelled
- **Search**: filters on prompt_preview + command_stem (client-side for loaded rows)

**Pagination**: "Load more" button (loads next 50). No pagination numbers.

**Active runs**: shown at top of the list regardless of sort order, with pulsing indicator. `awaiting_input` runs also appear at the top, with amber pulsing.

**States**:
| State | Display |
|---|---|
| Loading | Skeleton rows |
| Empty | "No runs yet. Launch your first run from a project." |
| All filtered out | "No runs match your filters." + Clear filters link |

---

### `/runs/[run_id]` — Run Terminal Viewer

**Purpose**: View the terminal output of a past (or active) run. Inspect cost, metadata, and resume the session.

**Layout**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  ← Run History    /polisher src/components/                    │
│         ├───────────────────────────────────┬───────────────────────────│
│         │                                   │  Run Details               │
│         │  Terminal (xterm.js)               │                           │
│         │  (replays stored output)           │  Project   My App         │
│         │                                   │  Branch    main           │
│         │  $ claude --print ...             │  Type      cmd            │
│         │  > Writing file: src/Button.tsx   │  Status    ✓ Completed    │
│         │  > Refactoring 3 components...    │  Started   2h ago         │
│         │  > Done.                          │  Duration  32s            │
│         │                                   │  Cost      $0.04          │
│         │                                   │  Tokens    ↑ 1.2k ↓ 0.4k │
│         │                                   │  Turns     3              │
│         │                                   │                           │
│         │                                   │  Session               ↻  │
│         │                                   │  cmd-polisher-20260328    │
│         │                                   │                           │
│         │                                   │  [Resume Session]         │
│         │                                   │                           │
│         │                                   │  [Delete Run]             │
└─────────────────────────────────────────────────────────────────────────┘
```

**Left area — Terminal**:
- xterm.js in replay mode
- On page load: fetch `/api/runs/{run_id}/output`, write bytes to xterm
- No WebSocket for completed runs (static replay)
- For active runs: connects to WS `/ws/run/{run_id}` (live streaming)
- Scroll to bottom automatically on initial load

**Right panel — Run Details**:
| Field | Value |
|---|---|
| Project | Name + link |
| Branch | Branch name or "main" |
| Type | Badge: `cmd` / `raw` / `resume` |
| Status | Badge (completed / failed / cancelled / active / awaiting_input) |
| Started | Relative timestamp ("2h ago") + absolute on hover |
| Duration | "32s" or "—" |
| Cost | "$0.04" or "—" |
| Tokens | Input ↑ / Output ↓ count |
| Turns | Number of Claude turns |
| Session | `session_name` in monospace (truncated if long) |

**[Resume Session]** button:
- Only visible if `claude_session_id` is present on the run
- Calls `POST /api/run/resume` with `session_id`
- Navigates to the new run's terminal (in the project IDE or this page)

**[Delete Run]** button:
- Confirmation dialog: "This will delete the run and its output. Are you sure?"
- Calls `DELETE /api/runs/{run_id}`
- Redirects to `/runs`

**Active run behavior**:
- If `status === "active"`, connect to WS instead of static replay
- Show live phase bar below terminal header
- Show elapsed time counter (live)
- Show [Cancel Run] button instead of [Delete Run]

**Awaiting input behavior**:
- If `status === "awaiting_input"`, connect to WS and show an amber banner: "Waiting for your input — open the project IDE to respond."
- The banner includes a link to the project IDE for the relevant run

---

## Storage Format

### Run metadata
`~/.factory-projects/{project_id}/runs/{run_id}.json`

One file per run, containing the full `Run` object.

### PTY output buffer
`~/.factory-projects/{project_id}/runs/{run_id}.output.gz`

- Raw PTY bytes, gzip compressed
- Capped at 2MB uncompressed
- Written as a ring buffer during execution; finalized on run end
- Served decompressed by `GET /api/runs/{run_id}/output`

### Run index
`~/.factory-projects/{project_id}/runs/_index.json`

A flat array of `RunListItem` objects for fast listing without reading all individual files.

Updated on every run state change (start, end, cost update).

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `RunHistoryPage` | `app/(app)/runs/page.tsx` | Full history list with filters |
| `RunsTable` | `components/runs/RunsTable.tsx` | Table with sorting, type badges, status badges, resume action |
| `RunStatusBadge` | `components/runs/RunStatusBadge.tsx` | Colored status indicator |
| `RunTypeBadge` | `components/runs/RunTypeBadge.tsx` | cmd / raw / resume type badge |
| `RunFilters` | `components/runs/RunFilters.tsx` | Project + status dropdowns, search input |
| `RunViewerPage` | `app/(app)/runs/[run_id]/page.tsx` | Terminal + details panel |
| `RunDetailsPanel` | `components/runs/RunDetailsPanel.tsx` | Right panel with metadata, cost, session, actions |
| `TerminalReplay` | `components/terminal/TerminalReplay.tsx` | xterm.js in static replay or live WS mode |

**TanStack Query hooks**:
- `useRuns(filters)` — GET /api/runs with filters
- `useRun(id)` — GET /api/runs/{id}
- `useRunOutput(id)` — GET /api/runs/{id}/output (binary)
- `useDeleteRun(id)` — DELETE /api/runs/{id}

---

## Acceptance Criteria

**History page**
- Given runs exist, When I open `/runs`, Then all runs are shown newest-first with project, type badge, status, duration, and cost
- Given a run is active, Then it appears at the top with a pulsing green indicator
- Given a run has status `awaiting_input`, Then it appears at the top with a pulsing amber indicator
- Given I filter by project, Then only runs for that project are shown
- Given I filter by status "Failed", Then only failed runs are shown
- Given I click a run row, Then I navigate to `/runs/{run_id}`
- Given a run has a session_id, Then a `[↻]` resume button appears in that row
- Given a run has type "raw", Then its prompt_preview shows "Raw Claude Terminal"
- Given a run has type "command", Then its prompt_preview shows the slash-command and args

**Run viewer**
- Given I open `/runs/{run_id}` for a completed run, Then the terminal replays the stored output
- Given I open `/runs/{run_id}` for an active run, Then the terminal streams live via WebSocket
- Given I open `/runs/{run_id}` for an awaiting_input run, Then an amber banner appears with a link to the project IDE
- Given the run has cost data, Then input/output tokens and USD cost are shown in the details panel
- Given I click [Resume Session], Then `POST /api/run/resume` is called and a new run opens
- Given I click [Delete Run] and confirm, Then the run is deleted and I am redirected to `/runs`
- Given a run has no session_id, Then the [Resume Session] button is not shown

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: run index + storage structure | M |
| Backend: GET /api/runs with filters + pagination | M |
| Backend: GET /api/runs/{id}/output (serve gzipped buffer) | M |
| Backend: DELETE /api/runs/{id} | S |
| Frontend: RunsTable + RunStatusBadge + RunTypeBadge + filters | L |
| Frontend: Run viewer page layout (terminal + details panel) | M |
| Frontend: TerminalReplay (static mode) | M |
| Frontend: Active run viewer (WS live mode, already built in sprint 3) | S |
| Frontend: Awaiting input banner in run viewer | S |
| Frontend: Resume from history | S |
