# Factory UI V2 — Launch Panel UX Specification

**Status**: Draft
**Date**: 2026-03-28
**Depends on**: `02-project-ide.md`, `03-run-execution.md`

---

## Summary

The launch panel is the right panel's Launch tab in the Project IDE. It is the entry point to every Claude Code run. The user types `/cmd args` to run a command, or opens a Raw Claude Terminal for free-form interaction with Claude.

There is no free-form task mode in the launch panel. Free-form interaction uses the Raw Claude Terminal. There is no `POST /api/run/task` endpoint and no `POST /api/run/workflow` endpoint. Everything is `/cmd args`.

---

## Run Types (User-Facing: 2)

| Type | Endpoint | Input |
|---|---|---|
| **Command** | `POST /api/run/command` | `/stem args` — command must exist in project's `.claude/` |
| **Raw** | `POST /api/run/raw` | Interactive Claude session |

Resume (`POST /api/run/resume`) is triggered from Run History or the Recent Runs section, not from the command input.

The routing logic is simple: if the input starts with `/`, parse the stem and args, call `POST /api/run/command`. Otherwise the Run button is disabled.

---

## V1 Problems This Spec Fixes

| V1 Problem | V2 Solution |
|---|---|
| Free-form task input in launch panel | Removed — use Raw Claude Terminal instead |
| POST /api/run/task and POST /api/run/workflow endpoints | Removed — only /api/run/command, /api/run/raw, /api/run/resume |
| Workflow context entries (text + file path fields) | Removed — no workflow launch concept |
| Browse Library button in launch panel | Removed — install commands from Library page first, then they appear in autocomplete |
| Batch launch modal | Cut in V2 |
| Direct agent launch | Removed — agents are command internals, not launch targets |
| Type selector exposed to user | Removed — there is only one input mode |

---

## Primary Interaction Model

```
┌─────────────────────────────────────────────────────────────────┐
│  Launch                                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  /feature-spec Build the login page with OAuth            │  │
│  └───────────────────────────────────────────────────────────┘  │
│  / for commands                                                   │
│                                                                   │
│  Worktree ─────────────────────  Effort ──────────────────────── │
│  [feat/login ▾]                  [auto ▾]                        │
│  [skip permissions]                                               │
│                                                                   │
│                                               [▶ Run]             │
│                                                                   │
│  ────────────────────────────────────────────────────────────    │
│  [Open Raw Claude Terminal]                                       │
│                                                                   │
│  ── Recent ─────────────────────────────────────────────────     │
│  /polisher src/components/            32s  $0.04  [↻]            │
│  /feature-spec settings page           4m  $0.18  [↻]            │
│  /retro                               1m   $0.09  [↻]            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component: Command Input

### Behavior

**Empty state**: Placeholder text: `/ for commands`

**State 1 — Slash command in progress**: User types `/`. Autocomplete dropdown opens immediately.

```
/pol▌
──────────────────────────────────────────────
 /polisher    Code quality and cleanup
 ─── native ────
 /compact     Compact conversation history
```

- Dropdown sources: project commands from `GET /api/projects/{id}/commands` + hardcoded native commands
- Filtering: matches stem or description, case-insensitive
- Keyboard: up/down to navigate, Tab/Enter to select, Esc to close

**State 2 — Command selected**: Stem is inserted. User types `$ARGUMENTS` inline.

```
/feature-spec Build the login page with OAuth
```

On run: `stem: "feature-spec"`, `args: "Build the login page with OAuth"` → `POST /api/run/command`.

**State 3 — Plain text (no slash prefix)**: Run button is disabled. Placeholder hint: `/ for commands`. Plain text without a slash is not a valid input.

### Input element

- Single-line `<input>`, expandable to multi-line with Shift+Enter
- On expansion, the input becomes a `<textarea>` that grows with content

### Autocomplete source

Commands come exclusively from `GET /api/projects/{id}/commands` — the project's `.claude/` directory. The Library is not queried at run time. If a library item is not yet installed to the project, it will not appear here.

Native commands are hardcoded in the frontend:

```typescript
const NATIVE_COMMANDS = [
  { stem: "compact",  description: "Compact conversation history" },
  { stem: "clear",    description: "Clear conversation" },
  { stem: "cost",     description: "Show session cost" },
  { stem: "model",    description: "Switch model" },
]
```

Autocomplete display:
```
/feature-spec    Turn a raw idea into a spec     (project)
/polisher        Code quality and cleanup        (project)
/retro           Weekly retrospective            (project)
──── native ─────────────────────────────────────────────
/compact         Compact conversation history
/cost            Show session cost
```

When no project commands are installed:
```
No commands installed in this project.
Add from Library →
```

The "Add from Library →" link navigates to the Library page. Library items must be copied to the project's `.claude/` first — there is no inline Browse Library in the launch panel.

---

## Component: Controls Bar

Always visible below the command input.

| Control | Values | Default | Notes |
|---|---|---|---|
| **Worktree** | Dropdown of project worktrees + `main` | `main` | Selecting a worktree sets the run's cwd and updates the file tree root |
| **Effort** | auto / low / medium / high / max | `auto` | Displayed as text, not slider |
| **Skip permissions** | Toggle | off | Appends `--dangerously-skip-permissions` |

Effort label meanings (shown in tooltip):
- `auto` — Let Claude decide
- `low` — Minimal thinking, fast and cheap
- `medium` — Balanced
- `high` — Deep analysis
- `max` — Maximum reasoning (most expensive)

When effort is not `auto`, the process manager prepends `/effort {level}` as a PTY injection before the main prompt. This is invisible to the user.

---

## Component: Raw Claude Terminal Button

```
[Open Raw Claude Terminal]
```

Opens an interactive Claude session via `POST /api/run/raw`. The center area switches to terminal mode with a special "interactive" header (no phase bar, no stream-json parsing).

This is the correct surface for:
- Free-form questions about the codebase
- Debugging sessions without a predefined workflow
- Anything that doesn't fit a `/cmd`

---

## Component: Recent Runs

Shows the last 5 runs for this project, below the Raw Terminal button. Each row:

```
  /polisher src/components/    32s  $0.04  [↻]
  /feature-spec settings page   4m  $0.18  [↻]
  /retro                        1m  $0.09  [↻]
```

- `[↻]` button: resume the session via `POST /api/run/resume` with `session_id` from that run
- Clicking the run text: navigates to that run's terminal in the center area
- Failed runs show a red indicator instead of cost

---

## Component: Run Button

```
[▶ Run]
```

- **Disabled** if: command input is empty, OR the input does not start with `/`
- **Enabled** if: input starts with `/` and has at least a stem character
- On click:
  1. Parse input: `stem = input.split(' ')[0].slice(1)`, `args = input.slice(stem.length + 2).trim()`
  2. Call `POST /api/run/command` with `{ project_id, stem, args, worktree_id, effort, skip_permissions }`
  3. On response: the new run appears in the Run Navigator; center area switches to that run's terminal

---

## Run Routing Logic

```
User clicks [▶ Run]
  │
  └─ Input starts with "/"?
        ├─ Yes → parse stem + args → POST /api/run/command
        └─ No  → Run button was disabled; this branch never fires

User clicks [Open Raw Claude Terminal]
  └─ POST /api/run/raw → open interactive session in center area

User clicks [↻] on a recent run
  └─ POST /api/run/resume with session_id
```

---

## Mobile (< 640px)

- Command input is full-width
- Controls bar: Worktree and Effort stack vertically; Skip permissions is an icon toggle
- Raw Claude Terminal button: full-width
- Recent runs: show last 3 only, no cost display (space constraint)
- Terminal: full-screen overlay after run starts; back button returns to launch panel

---

## Empty States

| Scenario | Display |
|---|---|
| No project commands | "No commands installed in this project. Add from Library →" (in autocomplete) |
| No recent runs | "No runs yet for this project." |
| No worktrees | Only "main" shown in worktree selector |
| Claude CLI not on PATH | Run fails immediately with error message in terminal |

---

## Acceptance Criteria

**Command input**
- Given the Launch tab is open, the command input is visible without clicking anything
- Given I type `/`, the autocomplete dropdown opens with project commands + native commands
- Given I type plain text without a `/`, the Run button is disabled
- Given I type `/polisher src/`, the Run button is enabled
- Given I select a command from autocomplete, the stem is inserted and the cursor is placed after it
- Given the project has no `.claude/commands/`, the autocomplete shows only native commands with the "Add from Library" hint

**Controls bar**
- Given I select a worktree, the run uses that worktree's cwd
- Given I select a worktree, the file tree in the left panel switches to that worktree's path
- Given effort is not auto, `/effort {level}` is injected before the main prompt
- Given skip permissions is on, `--dangerously-skip-permissions` is appended

**Run button**
- Given input is empty, the Run button is disabled
- Given input starts with `/`, the Run button is enabled
- Given I click Run, `POST /api/run/command` is called with the parsed stem and args
- Given the run launches, it appears in the Run Navigator and the center area shows its terminal

**Raw Claude Terminal**
- Given I click [Open Raw Claude Terminal], `POST /api/run/raw` is called
- Given a raw terminal opens, no phase bar is shown
- Given a raw terminal is open, I can type freely to Claude

**Recent runs**
- Given a recent run has a session_id, the [↻] resume button is visible
- Given I click [↻], `POST /api/run/resume` is called and the terminal opens in the center area
- Given 6 or more runs exist for the project, only the last 5 are shown

**Mobile**
- Given screen width < 640px, controls stack vertically
- Given a run starts on mobile, the terminal is full-screen

---

## Components List

| Component | File | Description |
|---|---|---|
| `LaunchTab` | `components/project/LaunchTab.tsx` | Container for the full Launch tab |
| `CommandInput` | `components/project/CommandInput.tsx` | Single-line slash input, expandable on Shift+Enter |
| `CommandAutocomplete` | `components/project/CommandAutocomplete.tsx` | Dropdown: project commands + native; empty state with library link |
| `ControlsBar` | `components/project/ControlsBar.tsx` | Worktree selector, effort selector, skip permissions toggle |
| `WorktreeSelector` | `components/project/WorktreeSelector.tsx` | Dropdown of worktrees + main |
| `EffortSelector` | `components/project/EffortSelector.tsx` | auto/low/medium/high/max dropdown |
| `RawTerminalButton` | `components/project/RawTerminalButton.tsx` | CTA that launches POST /api/run/raw |
| `RecentRuns` | `components/project/RecentRuns.tsx` | Last 5 runs with resume buttons |
| `RunButton` | `components/project/RunButton.tsx` | Disabled/enabled state, parses input and calls POST /api/run/command |

**Custom hooks**:
- `useProjectCommands(projectId)` — GET /api/projects/{id}/commands, cached
- `useLaunchCommand()` — POST /api/run/command mutation
- `useLaunchRaw()` — POST /api/run/raw mutation
- `useResumeRun()` — POST /api/run/resume mutation
- `useRecentRuns(projectId)` — GET /api/runs?project_id={id}&limit=5

---

## Sprint Sizing

| Ticket | Size |
|---|---|
| CommandInput (single-line, Shift+Enter expand, slash detection) | M |
| CommandAutocomplete (project + native sources, keyboard nav) | M |
| ControlsBar (worktree, effort, skip-permissions) | M |
| RawTerminalButton + POST /api/run/raw integration | S |
| RecentRuns + resume button | M |
| RunButton (disabled logic, parse stem+args, call endpoint) | S |
| LaunchTab assembly + mobile layout | M |
| TanStack Query hooks for launch panel | S |

---

## What Was Cut from V1

| Removed | Reason |
|---|---|
| Free-form task input (plain text box) | Free-form interaction belongs in Raw Claude Terminal, not the launch panel |
| POST /api/run/task | Endpoint does not exist in V2 |
| POST /api/run/workflow | Endpoint does not exist in V2 — workflows are just commands |
| Workflow context entries UI | No workflow launch concept in V2 |
| Browse Library button in launch panel | Library items must be installed to the project first; launch panel shows only what is installed |
| Batch launch modal | Cut in V2 |
| Direct agent launch | Agents are command internals, not launch targets |
| Separate LaunchModal per type | Unified into single command input |
| Type selector | There is one input: `/cmd args` |
