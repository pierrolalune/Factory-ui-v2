# Spec 03 — Run Execution

**Domain**: Run
**Routes**: Launch panel (inside `/projects/[id]`), WebSocket `/ws/run/{id}`
**Sprint**: 3

---

## Overview

Run execution is the core value of Factory UI. A run is a single invocation of the Claude CLI against a project directory or worktree.

Two key corrections from earlier drafts:

1. **No file provisioner on launch.** Commands are only launchable if they already exist in the project's `.claude/commands/` (or `.claude/skills/`, etc.). The library is for managing and installing items — it is not involved at run time. The launcher scans the project's `.claude/` directory to discover available commands.

2. **`awaiting_input` is a first-class run state.** When Claude pauses waiting for a permission confirmation or user response, the run enters `awaiting_input` status. This is the most critical state to surface in the UI — the user runs many things in parallel and needs to immediately see which runs are blocked waiting for them.

---

## Tech Stack

- **Backend**: FastAPI, Python 3.11+, ConPTY on Windows
- **Claude CLI**: `claude --print --output-format stream-json --verbose [--dangerously-skip-permissions] /{stem} {args}`
- **WebSocket**: FastAPI WebSocket at `/ws/run/{run_id}`
- **Frontend**: xterm.js, Zustand, TanStack Query

---

## Run Types

| Type | Endpoint | What it does | Run ID prefix |
|---|---|---|---|
| **Command** | `POST /api/run/command` | Runs `/{stem} {args}` — the command must exist in `project/.claude/` | `cmd-` |
| **Raw** | `POST /api/run/raw` | Opens interactive `claude` session (no `--print`, no stream-json) | `raw-` |
| **Resume** | `POST /api/run/resume` | Resumes a past Claude session via `--resume` | `rs-` |

From the user's perspective, everything is a `/cmd`. The distinction between "command" and "workflow" lives in the `.md` files inside `.claude/`, not in Factory UI.

---

## Run Status — Full State Machine

```
pending → active → completed
                → failed
                → cancelled
                → awaiting_input → active   (user responded, run continues)
                                → cancelled (user cancelled while waiting)
```

```typescript
type RunStatus =
  | "pending"          // registered, not yet spawned
  | "active"           // Claude is running (tool use, thinking, writing)
  | "awaiting_input"   // Claude paused, waiting for user to respond in the terminal
  | "completed"        // exited cleanly (exit code 0, stream-json result event received)
  | "failed"           // exited with non-zero code or error
  | "cancelled"        // user cancelled via SIGTERM
```

### What triggers `awaiting_input`

Claude Code in `--print` mode is normally non-interactive. But it CAN pause and write a prompt to the PTY when:
- A tool requires permission and `--dangerously-skip-permissions` is **not** set (e.g., bash execution, file write outside project)
- Claude shows an interactive confirmation: `Allow this action? [y/n]`

The backend `PromptDetector` watches PTY output for these patterns and transitions the run to `awaiting_input`.

**Pattern detection**: watch for lines matching:
- `\[y/n\]\s*$` or `\[Y/n\]\s*$` or `\[yes/no\]\s*$` at end of line
- `> ` prompt at start of a new line after output stops
- Known Claude Code permission prompt prefixes

When detected: emit `awaiting_input_update` WS event, update run status, persist state.

When the user types a response in xterm.js and the PTY resumes output: transition back to `active`.

### UI representation (per spec 02)

| Status | Run Navigator indicator | Run card phase line |
|---|---|---|
| `active` | `●` lime green pulsing | `▶ Writing: src/auth.ts` |
| `awaiting_input` | `⚡` amber pulsing, **bold** | `⚡ Waiting for your input` |
| `completed` | `✓` muted | `✓ Completed` |
| `failed` | `✗` red | `✗ Failed` |
| `cancelled` | `⊘` grey | `⊘ Cancelled` |

`awaiting_input` runs sort to the **top** of the Run Navigator, above other active runs — because they are blocked and need immediate attention.

---

## Data Model

### Run

```typescript
interface Run {
  run_id: string              // e.g. "cmd-polisher-a3f2b1c4"
  type: "command" | "raw" | "resume"
  status: RunStatus           // see state machine above
  exit_code?: number

  project_id: string
  project_name: string
  project_path: string        // absolute cwd for this run
  worktree_path?: string      // if running in a worktree, its absolute path

  command_stem?: string       // e.g. "polisher" (for type=command)
  command_args?: string       // e.g. "src/components/" (ARGUMENTS value)
  prompt: string              // full constructed prompt sent to claude

  branch?: string             // git branch name (from worktree or main)
  effort?: "low" | "medium" | "high" | "max"
  skip_permissions: boolean

  started_at: string
  ended_at?: string
  duration_ms?: number

  claude_session_id?: string  // from stream-json init event
  session_name?: string       // set via /rename injection

  total_cost_usd?: number
  input_tokens?: number
  output_tokens?: number
  num_turns?: number

  error_message?: string      // last error output (max 500 chars)
  awaiting_input: boolean     // true when status = "awaiting_input"
}
```

---

## API Endpoints

### `GET /api/projects/{id}/commands`
Scan the project's `.claude/` directory and return available slash commands.

This is the source for the launch panel autocomplete — NOT the library.

**Behavior**: Reads `{project_path}/.claude/commands/` (and optionally `.claude/skills/`). Each `.md` file becomes a command entry.

**Response**:
```json
[
  {
    "stem": "polisher",
    "name": "Polisher",
    "description": "Code quality and cleanup pass",
    "source_path": ".claude/commands/polisher.md",
    "type": "command",
    "has_arguments": true
  },
  {
    "stem": "feature-spec",
    "name": "Feature Spec",
    "description": "Turn a raw idea into a full spec",
    "source_path": ".claude/commands/feature-spec.md",
    "type": "command",
    "has_arguments": true
  },
  {
    "stem": "architect",
    "name": "Architect",
    "description": "System design agent",
    "source_path": ".claude/agents/architect.md",
    "type": "agent"
  }
]
```

`has_arguments`: true if the command content contains `$ARGUMENTS` placeholder.

**Note**: If `project/.claude/` does not exist or is empty, returns `[]`. The UI shows an empty autocomplete with a hint: "No commands installed. Add commands from the Library."

---

### `POST /api/run/command`
Launch a slash command that exists in the project's `.claude/`.

**Request**:
```json
{
  "project_id": "my-app-a3f2b1",
  "stem": "polisher",
  "args": "src/components/",
  "worktree_id": null,
  "effort": null,
  "skip_permissions": false
}
```

- `stem`: the command name (must exist in project's `.claude/commands/` or `.claude/skills/`)
- `args`: the `$ARGUMENTS` value — everything after `/stem ` as a string
- `worktree_id`: if set, the run's `cwd` is the worktree path instead of project root

**Validation**:
- `stem` must exist in the project's `.claude/` — returns `400 command_not_found` if not
- No library lookup, no file copy — the command is already on disk

**Prompt construction**: `/{stem} {args}` — e.g. `/polisher src/components/`

**Response**: `{ "run_id": "cmd-polisher-a3f2b1c4" }`

---

### `POST /api/run/raw`
Open an interactive Claude session (no `--print`, no stream-json).

**Request**:
```json
{
  "project_id": "my-app-a3f2b1",
  "worktree_id": null,
  "skip_permissions": false
}
```

**Backend**: Spawns `claude [--dangerously-skip-permissions]` as a PTY subprocess. No prompt injection, no effort prefix, no session rename. Just raw Claude.

**Response**: `{ "run_id": "raw-a3f2b1c4" }`

---

### `POST /api/run/resume`
Resume a past Claude session.

**Request**:
```json
{
  "session_id": "12345678-abcd-ef01-2345-6789abcdef01",
  "project_id": "my-app-a3f2b1",
  "worktree_id": null
}
```

Either `session_id` (UUID) or `session_name` (string) required.

**Backend**: Spawns `claude --resume {session_id} --print --output-format stream-json --verbose` in the project (or worktree) directory.

**Response**: `{ "run_id": "rs-my-session-a3f2b1c4" }`

---

### `POST /api/run/{run_id}/cancel`
Cancel an active run (SIGTERM to PTY subprocess).

**Response**: `{ "ok": true }`

---

### `GET /api/run/{run_id}`
Get current run state.

**Response**: `Run` object

---

## Backend: Process Lifecycle

```
POST /api/run/command
  │
  ├─ 1. Validate request
  │      └─ check stem exists in project/.claude/commands/{stem}.md
  ├─ 2. Resolve cwd:
  │      worktree_id set → cwd = worktree.path
  │      else            → cwd = project.path
  ├─ 3. Build prompt: "/{stem} {args}"
  ├─ 4. build_run_id(): "cmd-{stem}-{hash8}"
  ├─ 5. process_manager.register_run(run_id, metadata)
  │      └─ saves run JSON to ~/.factory-projects/{project_id}/runs/{run_id}.json
  │      └─ status = "pending"
  ├─ 6. process_manager.spawn_run(run_id, cwd)
  │      ├─ Opens ConPTY subprocess:
  │      │     claude --print --output-format stream-json --verbose
  │      │            [--dangerously-skip-permissions]
  │      │            "/{stem} {args}"
  │      ├─ status → "active"
  │      ├─ Inject /rename {session_name}  → wait for prompt-ready
  │      ├─ Inject /effort {level}         → wait for prompt-ready (if effort set)
  │      └─ Background thread: read PTY bytes → broadcast WS + parse stream-json
  └─ 7. Return { run_id }
```

**No file provisioner step.** The command is expected to exist in `cwd/.claude/commands/{stem}.md` already. If it does not exist, the API returns `400 command_not_found` immediately.

---

## Backend: Claude CLI Not Found

If the `claude` binary is not found on PATH when attempting to spawn, the run fails immediately without spawning a process:

- `run.status` → `"failed"`
- `run.exit_code` → `null`
- `run.error_message` → `"Claude CLI not found. Make sure claude is installed and on PATH."`
- The failure is broadcast as a `status_update` WS event with `status: "failed"`

This is checked at spawn time, not at validation time, so the `run_id` is still registered and visible in run history.

---

## Backend: `awaiting_input` Detection

The `PromptDetector` runs in the PTY read loop alongside normal output streaming.

```python
class PromptDetector:
    PERMISSION_PATTERNS = [
        r'\[y/n\]\s*$',
        r'\[Y/n\]\s*$',
        r'\[yes/no\]\s*$',
        r'Do you want to allow',
        r'Allow this action',
        r'Proceed\? \(',
    ]

    def feed(self, raw_bytes: bytes) -> list[str]:
        """
        Returns list of state transitions triggered by this chunk.
        Possible values: "awaiting_input", "active"
        """
```

When `awaiting_input` is triggered:
1. `run.status` → `"awaiting_input"`, `run.awaiting_input` → `True`
2. Persist to run JSON
3. Broadcast WS `awaiting_input_update` event to all subscribers

When PTY output resumes after user types:
1. `run.status` → `"active"`, `run.awaiting_input` → `False`
2. Broadcast `awaiting_input_update` with `awaiting_input: false`

---

## Backend: Concurrent Run Guard

Multiple runs on the same worktree are allowed — Claude handles concurrent access gracefully. However, the UI warns the user when more than 3 runs are active on the same worktree simultaneously, as this can indicate an accidental loop or runaway state.

**Warning trigger**: when `POST /api/run/command` is called and the target worktree already has 3 or more active runs, the response includes a warning field:

```json
{
  "run_id": "cmd-polisher-a3f2b1c4",
  "warning": "concurrent_runs_high",
  "warning_message": "3 runs are already active on this worktree."
}
```

The run is still launched — this is a non-blocking warning. The frontend displays a toast: "3 runs are already active on feat/login. Consider reviewing before launching more."

---

## WebSocket Protocol

**Endpoint**: `GET /ws/run/{run_id}`

### On Connection

Server immediately sends:
1. `run_info` — full current run state
2. Buffered PTY replay (last ~500KB, base64)

### Server → Client Messages

```typescript
// Raw PTY bytes
{ "type": "pty_output", "data": "base64string" }

// Status changed (active / completed / failed / cancelled)
{ "type": "status_update", "status": "completed", "exit_code": 0 }

// awaiting_input state changed — CRITICAL for multi-run display
{
  "type": "awaiting_input_update",
  "awaiting_input": true   // or false when resumed
}

// Current tool/phase (parsed from stream-json assistant events)
{
  "type": "phase_update",
  "phase": "tool_use",        // "thinking" | "tool_use" | "text" | "idle"
  "tool_name": "Write",
  "file_path": "src/auth.ts"
}

// Final cost/tokens (from stream-json result event)
{
  "type": "cost_update",
  "cost_usd": 0.06,
  "input_tokens": 12400,
  "output_tokens": 3200,
  "num_turns": 4
}

// Full run state on connect
{ "type": "run_info", "run": { ...Run } }
```

### Client → Server Messages

```typescript
// Terminal resize
{ "type": "resize", "cols": 120, "rows": 40 }
```

The `awaiting_input_update` message is consumed by the **Run Navigator** (spec 02) — not just the terminal pane. Even if the user is not watching that terminal, the Run Navigator must update the run card to show `⚡ Waiting for your input`.

### How the Run Navigator receives these updates

The Run Navigator subscribes to run state updates via a separate polling or global WebSocket channel — it does NOT need to open a terminal WebSocket for every run. Two approaches:

**Option A (recommended)**: A project-level WebSocket `GET /ws/project/{project_id}/runs` that broadcasts lightweight state updates for all runs of that project:
```typescript
{
  "type": "run_state",
  "run_id": "cmd-polisher-a3f2b1c4",
  "status": "awaiting_input",
  "awaiting_input": true,
  "phase": "...",
  "cost_usd": 0.06,
  "elapsed_ms": 42000
}
```

**Option B (simpler)**: Poll `GET /api/runs?project_id={id}&status=active` every 2s for the Run Navigator. Less real-time but simpler to implement.

Recommendation: Start with Option B (polling), upgrade to Option A once the core is stable.

---

## WebSocket Reconnection Strategy

Network interruptions are expected in long-running sessions. The frontend handles disconnects with exponential backoff.

### Reconnect schedule

| Attempt | Delay before retry |
|---|---|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5 | 16s |

Maximum 5 reconnect attempts. After all attempts are exhausted, show a static error state.

### Behavior during reconnect

- Frontend displays a "Reconnecting..." overlay over the terminal pane (semi-transparent, non-blocking — existing terminal content remains visible beneath)
- On successful reconnect: server sends the full PTY replay buffer (last ~500KB) so the terminal catches up to the current state
- Multiple browser tabs: each tab maintains its own independent WS connection. All connections for the same `run_id` receive the same PTY data stream from the server.

### After max retries exceeded

Show a non-dismissable banner inside the terminal pane:

```
  Connection lost after 5 attempts.
                                  [Retry]
```

Clicking [Retry] resets the attempt counter and starts the reconnect schedule again from attempt 1.

---

## stream-json Parsing

The backend parses stream-json in the PTY read loop (alongside PromptDetector) to emit structured WS events.

```typescript
// From PTY stream — these JSON lines are parsed:

// Session init
{ "type": "system", "subtype": "init", "session_id": "uuid", "model": "..." }

// Assistant turn (text or tool use)
{
  "type": "assistant",
  "message": { "content": [
    { "type": "text", "text": "I'll create the auth module..." },
    { "type": "tool_use", "name": "Write", "input": { "file_path": "src/auth.ts" } }
  ]}
}

// Tool result
{ "type": "user", "message": { "content": [{ "type": "tool_result", ... }] } }

// Final result
{ "type": "result", "subtype": "success", "cost_usd": 0.06, "num_turns": 4, ... }
```

**ConPTY line wrapping (Windows)**: ConPTY inserts CR+LF at column 120 inside JSON lines. The parser must reassemble wrapped lines before calling `json.loads()`. Use `_iter_json_objects()` that buffers partial lines across PTY chunks.

**ANSI stripping**: PTY injects escape sequences into the byte stream. Must strip `\x1b[...` CSI sequences and OSC sequences before JSON parsing.

---

## Command Discovery — Autocomplete Source

The Launch tab in the IDE (spec 02) shows a `/` autocomplete. The source is:

```
GET /api/projects/{id}/commands
  ↑ scans project/.claude/commands/
            project/.claude/skills/
            (NOT the library)
```

Combined with **native Claude Code commands** (built-in slash commands like `/compact`, `/clear`, `/cost`) that are always available regardless of what's installed.

Native commands are hardcoded in the frontend (they don't change):
```typescript
const NATIVE_COMMANDS = [
  { stem: "compact",  description: "Compact conversation history" },
  { stem: "clear",    description: "Clear conversation" },
  { stem: "cost",     description: "Show session cost" },
  { stem: "model",    description: "Switch model" },
]
```

**Autocomplete display**:
```
/feature-spec    Turn a raw idea into a spec     (project)
/polisher        Code quality and cleanup        (project)
/retro           Weekly retrospective            (project)
──── native ─────────────────────────────────────────────
/compact         Compact conversation history
/cost            Show session cost
```

If `project/.claude/` is empty or doesn't exist:
```
No commands installed in this project.
Add from Library →
```

---

## Frontend: xterm.js Integration

- Initialize with `cols: 120, rows: 40`
- **Race condition fix**: buffer incoming `pty_output` messages in a ref before xterm is initialized; flush after init completes
- Decode base64: `Uint8Array.from(atob(msg.data), c => c.charCodeAt(0))`
- On resize: send `{ type: "resize", cols, rows }` to WebSocket
- Multiple terminals: lazily mounted, kept in DOM as `display: none` when not focused (see spec 02)

```typescript
// @ts-expect-error — xterm CSS has no type declarations
import '@xterm/xterm/css/xterm.css'
```

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `LaunchTab` | `components/project/LaunchTab.tsx` | `/cmd` input, autocomplete, worktree + effort selectors, Run button, Raw Terminal button |
| `CommandInput` | `components/project/CommandInput.tsx` | Single-line input, `/` triggers autocomplete |
| `CommandAutocomplete` | `components/project/CommandAutocomplete.tsx` | Dropdown: project commands + native commands |
| `TerminalPane` | `components/terminal/TerminalPane.tsx` | xterm.js + WS lifecycle (used for both command and raw runs) |
| `RunHeader` | `components/terminal/RunHeader.tsx` | Header bar: run name, branch, effort, elapsed, cost, cancel/close |
| `PhaseBar` | `components/terminal/PhaseBar.tsx` | Live tool display — also shows `⚡ Waiting for your input` |
| `AwaitingInputBadge` | `components/terminal/AwaitingInputBadge.tsx` | Amber pulsing badge used in PhaseBar and RunCard |
| `ReconnectingOverlay` | `components/terminal/ReconnectingOverlay.tsx` | Semi-transparent overlay shown during WS reconnect attempts |
| `RunCard` | `components/project/RunCard.tsx` | In Run Navigator: shows status, phase, cost, awaiting_input state |

**Custom hooks**:
- `useProjectCommands(projectId)` — GET /api/projects/{id}/commands (with caching)
- `useLaunchCommand()` — POST /api/run/command
- `useLaunchRaw()` — POST /api/run/raw
- `useResumeRun()` — POST /api/run/resume
- `useCancelRun(id)` — POST /api/run/{id}/cancel
- `useRunWebSocket(runId)` — manages WS connection, reconnect backoff, parses incoming messages, updates Zustand

---

## Acceptance Criteria

**Command discovery**
- Given a project has `.claude/commands/polisher.md`, When I type `/pol`, Then "polisher" appears in the autocomplete
- Given `.claude/commands/` is empty, When I type `/`, Then I see only native commands + a "No commands installed. Add from Library →" hint
- Given I launch `/polisher src/`, Then the backend does NOT copy any files — it just runs the command in the project directory

**Run launch**
- Given I type `/polisher src/components/` and click Run, Then `POST /api/run/command` is called with `stem: "polisher"`, `args: "src/components/"`
- Given the command does not exist in `project/.claude/`, Then the API returns `400 command_not_found`
- Given I select worktree `feat/login`, Then the run's `cwd` is the worktree path, not the project root
- Given effort is "high", Then `/effort high` is injected before the main prompt

**Claude CLI not found**
- Given `claude` is not on PATH when a run is spawned, Then the run transitions immediately to `failed` with `error_message: "Claude CLI not found. Make sure claude is installed and on PATH."`
- Given this failure, Then `exit_code` is null and the error is visible in the run terminal

**Concurrent run guard**
- Given 3 runs are already active on a worktree, When I launch a 4th, Then the response includes `warning: "concurrent_runs_high"` and a toast appears in the UI
- Given 2 runs are active on a worktree, When I launch a 3rd, Then no warning is shown

**`awaiting_input` — critical**
- Given a run hits a permission prompt (e.g. `Allow this? [y/n]`), Then its status transitions to `awaiting_input`
- Given status becomes `awaiting_input`, Then the Run Navigator immediately shows `⚡ Waiting for your input` on that run's card (amber, pulsing)
- Given status becomes `awaiting_input`, Then that run card moves to the top of the Run Navigator
- Given the user focuses that terminal and types `y`, Then the run transitions back to `active` and the amber badge disappears
- Given multiple runs are active and one enters `awaiting_input`, Then ONLY that run shows the amber indicator
- Given I cancel a run that is `awaiting_input`, Then status becomes `cancelled`

**Terminal**
- Given a run starts, Then xterm.js connects to WS and renders PTY output
- Given PTY bytes arrive before xterm.js initializes, Then they are buffered and flushed after init
- Given I switch to a different run's terminal, Then it is instant (no reconnection — terminal is already mounted)
- Given a run completes, Then `status_update` with `completed` is received and the cost is shown in RunHeader

**WebSocket reconnection**
- Given the WS connection drops, Then the frontend attempts reconnect at 1s, 2s, 4s, 8s, 16s intervals
- Given a reconnect attempt is in progress, Then a "Reconnecting..." overlay appears over the terminal pane
- Given reconnect succeeds, Then the server replays the last ~500KB of PTY output and the overlay disappears
- Given all 5 reconnect attempts fail, Then a "Connection lost. [Retry]" message appears
- Given I click [Retry], Then the reconnect schedule resets and tries again from attempt 1
- Given two browser tabs have the same run open, Then both receive the same PTY output independently

**Raw terminal**
- Given I click [Open Raw Claude Terminal], Then `POST /api/run/raw` is called and an interactive session opens
- Given the raw terminal is open, Then no phase bar is shown (it's interactive, not stream-json)
- Given I type `/exit` in the raw terminal, Then the session ends

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: process_manager (PTY spawn, WS broadcast, run state) | XL |
| Backend: pty_backend (ConPTY, line reassembly, ANSI strip) | L |
| Backend: PromptDetector + awaiting_input transitions | L |
| Backend: Claude CLI not found — immediate fail path | S |
| Backend: concurrent run guard (count check + warning response) | S |
| Backend: project-level run state polling endpoint | M |
| Backend: GET /api/projects/{id}/commands (scan .claude/) | S |
| Backend: POST /api/run/command (no provisioner) | M |
| Backend: POST /api/run/raw (interactive PTY) | M |
| Backend: POST /api/run/resume | M |
| Backend: stream-json parser → phase/cost WS events | M |
| Backend: effort + /rename injection with idle detection | M |
| Frontend: CommandInput + CommandAutocomplete | M |
| Frontend: LaunchTab assembly | M |
| Frontend: TerminalPane (xterm.js + WS + buffer fix) | L |
| Frontend: WS reconnect strategy (backoff, overlay, retry button) | M |
| Frontend: RunHeader + PhaseBar + AwaitingInputBadge | M |
| Frontend: RunCard awaiting_input state (amber, sort-to-top) | M |
| Frontend: multi-terminal lazy mount/show pattern | L |
