# Spec 02 — Project IDE

**Domain**: Project
**Route**: `/projects/[id]`, `/projects/[id]/review`
**Sprint**: 2

---

## Overview

The Project IDE is where the user spends most of their time. The core workflow is:

1. Launch a `/cmd` against a worktree → Claude runs
2. Watch multiple runs in parallel (one per worktree) in the left panel
3. Click a run to focus its terminal in the center
4. Review the diff, commit, and merge the branch
5. Delete the worktree, start the next one

This is NOT a traditional editor. The user rarely types code — they launch Claude, watch, then manage branches. The layout is designed around **parallel worktree runs**, not single-file editing.

### Key design decisions

- **Launch = `/cmd` only**. The command input accepts `/stem args` exclusively. The command must already exist in the project's `.claude/` directory. Free-form interaction with Claude uses the Raw Claude Terminal, not the command input.
- **No free-form task mode in the IDE.** There is no `POST /api/run/task` endpoint. Users who want free-form interaction open the Raw Claude Terminal.
- **Project Overview is the default center view** — shows git status, active runs, recent activity.
- **Left panel = Run Navigator** — all active and recent runs grouped by worktree. Click any run to focus its terminal.
- **Branches tab = worktrees + merge** — since the user merges frequently, merge actions live next to worktrees (not buried in a separate page).

---

## Tech Stack

- **Route**: Next.js 15 App Router, `/projects/[id]`
- **Editor**: CodeMirror 6
- **Terminal**: `@xterm/xterm` — multiple xterm instances, one per run (lazily mounted)
- **State**: Zustand
- **Data**: TanStack Query

---

## Page Layout

### Desktop (>= 1024px)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ App  │  Run Navigator          │  Center Area                │  Right Panel │
│ Side │  (280px, fixed)         │  (flex, main)               │  (340px)     │
│ bar  │                         │                              │              │
│      │  my-app  ⎇ main         │  [Overview]                 │  [Launch]    │
│      │  ─────────────────────  │  or [Terminal: run_id]      │  [Branches]  │
│      │  ● feat/login           │  or [Editor: file.ts]       │  [Review]    │
│      │    /polisher  0:42  $0.06│                             │              │
│      │    ▶ Writing auth.ts    │  (content switches based    │  (tab        │
│      │                         │   on selection in left nav) │   content)   │
│      │  ● feat/api             │                              │              │
│      │    /feature-spec 2:01   │                              │              │
│      │    ▶ Thinking...        │                              │              │
│      │                         │                              │              │
│      │  ✓ fix/bug  done        │                              │              │
│      │    /polisher  $0.04     │                              │              │
│      │    [Merge]  [Delete ×]  │                              │              │
│      │                         │                              │              │
│      │  ─────────────────────  │                              │              │
│      │  [Overview]  [Files]    │                              │              │
└────────────────────────────────────────────────────────────────────────────┘
```

### Desktop (768–1023px)

Right panel hidden by default, toggled via header icon. Run Navigator collapses to icons + run count badges.

### Mobile (< 640px)

```
┌──────────────────────────────┐
│  My App  ⎇ main      [⋮]    │
├──────────────────────────────┤
│                               │
│  Center Area                  │
│  (Overview / Terminal /       │
│   Editor — one at a time)     │
│                               │
├──────────────────────────────┤
│  [Runs (2)]  [Files]  [Run]  │
└──────────────────────────────┘
```

---

## Panel: Run Navigator (Left)

This is the most important panel. It replaces the old "file tree only" left panel.

The left panel has **two modes** toggled by a bottom tab bar:

```
  ─── bottom of left panel ───
  [Runs]   [Files]
```

Default: **Runs** mode.

---

### Runs Mode

Shows all runs for this project, grouped by worktree branch. Ordered: active first (newest), then completed/failed (newest).

```
my-app  ⎇ main
─────────────────────────────────────

● feat/login
  ┌────────────────────────────────┐
  │  /polisher  ·  0:42  ·  $0.06  │  ← click to focus terminal
  │  ▶ Writing: src/auth.ts        │  ← live phase (stream-json)
  └────────────────────────────────┘
  ┌────────────────────────────────┐
  │  /retro  ·  1:12  ·  $0.12     │
  │  ▶ Reading: CLAUDE.md          │
  └────────────────────────────────┘

● feat/api
  ┌────────────────────────────────┐
  │  /feature-spec  ·  2:01  $0.18 │
  │  ▶ Thinking...                 │
  └────────────────────────────────┘

✓ fix/bug                [Merge ↗]  [Delete ×]
  ┌────────────────────────────────┐
  │  /polisher  ·  done  ·  $0.04  │
  │  ✓ Completed                   │
  └────────────────────────────────┘

─────────────────────────────────────
main (project root)
  ┌────────────────────────────────┐
  │  /commit  ·  done  ·  $0.02    │
  │  ✓ Completed  ·  3h ago        │
  └────────────────────────────────┘
```

**Worktree group header**:
- Branch name + status indicator: `●` green (has active run), `✓` grey (all done), `⊘` failed
- For completed worktrees: `[Merge ↗]` and `[Delete ×]` action buttons inline

**Run card**:
- Command name (e.g. `/polisher`)
- Elapsed time (live counter if active) + cost
- Phase line (live, from stream-json parsing): tool name + file
- Click → focuses that run's terminal in the center area
- Currently focused run: highlighted card border (`#4195e8`)

**Empty state**: "No runs yet for this project. Launch your first `/cmd` from the Launch tab."

---

### Files Mode

Standard file tree. Data comes from `GET /api/projects/{id}/file-tree` (spec 01).

```
my-app/
├── src/
│   ├── index.ts
│   ├── auth.ts     ← (M) amber dot if modified
│   └── utils/
├── tests/
└── README.md
```

- Click a file → opens in editor in center area
- Modified files get amber indicator (from git status)
- Lazy loading per directory
- When a worktree is selected in the Launch tab, the file tree switches its root to that worktree's path (passes `worktree_path` to `GET /api/projects/{id}/file-tree`)

---

## Center Area — 3 Modes

The center area switches between three modes. The mode is determined by what is selected in the left panel or right panel.

### Mode 1: Project Overview (default)

Shown when no run is focused and no file is open.

```
┌──────────────────────────────────────────────────────────────────────┐
│  my-app                                                               │
│  /Users/pierre/code/my-app  ·  Node.js · TypeScript · React          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ── Git Status ────────────────────────────────────────────────────── │
│  ⎇ main  ·  3 modified  ·  1 untracked  ·  0 staged                  │
│  Last commit: a3f2b1c  "feat: add session service"  2h ago            │
│                                                                        │
│  ── Active Runs ────────────────────────────────────────────────────── │
│  ● feat/login   /polisher        0:42  $0.06   ▶ Writing auth.ts      │
│  ● feat/api     /feature-spec    2:01  $0.18   ▶ Thinking...          │
│                                                                        │
│  ── Recent Runs ────────────────────────────────────────────────────── │
│  ✓  fix/bug    /polisher   $0.04   32s   3h ago        [↻ resume]     │
│  ✓  main       /retro      $0.12   4m    Yesterday     [↻ resume]     │
│  ✗  feat/x     /factory    $0.31   8m    2d ago                       │
│                                                                        │
│  ── Worktrees ──────────────────────────────────────────────────────── │
│  feat/login   ● 2 active runs                                          │
│  feat/api     ● 1 active run                                           │
│  fix/bug      ✓ done · 2 ahead · [Merge to main]                      │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

**Sections**:
- **Git Status**: current branch, modified/staged counts, last commit hash + message + timestamp
- **Active Runs**: live list with phase — click any row to focus its terminal
- **Recent Runs**: last 5 completed/failed runs with cost, duration, resume button
- **Worktrees**: all worktrees with status and quick merge action

Overview auto-refreshes every 5s (via `useProject` + `useRuns` polling).

---

### Mode 2: Run Terminal

Shown when user clicks a run card in the left panel or a row in the overview.

```
┌─────────────────────────────────────────────────────────────────────┐
│  /polisher  ·  feat/login  ·  high  ·  0:42  ·  $0.06       [✕]    │
├─────────────────────────────────────────────────────────────────────┤
│  ▶ Writing file: src/auth.ts                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [xterm.js terminal — PTY output]                                     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

- `[✕]` returns center to Overview (run continues)
- Multiple runs can be "open" simultaneously — each has its own xterm.js instance, lazily mounted and kept alive in the DOM (display: none when not focused)
- Switching between run terminals is instant (no reconnection)
- Completed run terminals remain viewable (static replay)

**Lazy terminal mounting**: xterm.js instances are created on first click and kept in a hidden container. This avoids WebSocket reconnection and buffer re-replay on every switch.

---

### Mode 3: File Editor

Shown when user clicks a file in the Files tree.

- Tab bar at top (open files)
- CodeMirror 6 editor below
- File content loaded via `GET /api/projects/{id}/file?path={relPath}&worktree_path={worktreePath}`
- Auto-save on blur via `PUT /api/projects/{id}/file`
- When a worktree is active in the Launch tab, file reads and writes use `worktree_path` parameter
- File tree click while terminal is focused: opens editor in a split or replaces — user can dismiss with `[✕]`

---

## Right Panel — 3 Tabs

Default tab: **Launch**.

```
  [Launch]  [Branches]  [Review]
```

### Tab: Launch

The command input is for `/cmd args` only. For free-form interaction with Claude, use the Raw Claude Terminal button.

```
┌───────────────────────────────────────────────────────────┐
│  Launch                                                     │
├───────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  /feature-spec Build the login page with OAuth      │  │
│  └─────────────────────────────────────────────────────┘  │
│  / for commands                                            │
│                                                             │
│  Worktree ──────────────────── Effort ──────────────────── │
│  [feat/login ▾]                [auto ▾]                    │
│  [skip permissions]                                         │
│                                                             │
│                                         [▶ Run]             │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│  OR                                                         │
│  [Open Raw Claude Terminal]                                 │
│                                                             │
└───────────────────────────────────────────────────────────┘
```

**Command input**:
- Single-line input, expandable with Shift+Enter
- Accepts `/stem args` only — the stem must exist in the project's `.claude/commands/` or `.claude/skills/`
- Placeholder: `/ for commands`
- `/` triggers autocomplete dropdown sourced from `GET /api/projects/{id}/commands` (project commands only — no library picker here)
- Library commands must be installed to the project first via the Library page → "Copy to project"
- No free-form task mode — plain text without a `/` prefix is not a valid run input

**Autocomplete dropdown** (appears on `/`):
```
  /feature-spec    Turn a raw idea into a spec
  /polisher        Code quality and cleanup
  /retro           Weekly retrospective
  ─── native ──────────────────────────────
  /commit          Stage and commit changes
  /compact         Compact conversation
```

**Controls bar**:
- **Worktree selector**: dropdown of project worktrees + main. When a worktree is selected, the file tree and editor use that worktree's path.
- **Effort selector**: auto / low / medium / high / max
- **Skip permissions toggle**: enables `--dangerously-skip-permissions`

**[Run] button**: disabled if command input is empty. On click: parse `/stem args` → `POST /api/run/command`.

**[Open Raw Claude Terminal]**: launches an interactive Claude session (see below). This is the correct surface for free-form exploration and questions about the codebase.

---

### Raw Claude Terminal

Launched from the `[Open Raw Claude Terminal]` button in the Launch tab.

**What it is**: An interactive Claude Code session (`claude` without `--print`) running in a PTY. The user types directly to Claude — no predefined workflow, no stream-json parsing, no phase display. Just a full xterm.js terminal connected to an interactive Claude session.

**Use case**: Free exploration, asking questions about the codebase, debugging, anything that doesn't fit a pre-defined `/cmd`.

**Backend**: Spawns `claude` (or `claude --dangerously-skip-permissions` if toggled) in a PTY in the project directory. The run is registered in the run history with type `"raw"` and run ID prefix `"raw-"`.

**Backend endpoint**:
```
POST /api/run/raw
{
  "project_id": "my-app-a3f2b1",
  "worktree_id": null,
  "skip_permissions": false
}
→ { "run_id": "raw-a3f2b1c4" }
```

**UI**: Opens the center area in terminal mode with a special header:
```
┌───────────────────────────────────────────────────────────────────┐
│  Claude Terminal  ·  feat/login  ·  interactive          [✕]      │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Welcome to Claude Code!                                            │
│  > ▌  (user types here — full interactive session)                 │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

No phase bar (no stream-json). The session persists until the user types `/exit` or clicks `[✕]`.

---

### Tab: Branches

Combines worktree management and branch merge in one panel — since the user's workflow is always: run → review diff → merge → delete.

```
┌───────────────────────────────────────────────────────────┐
│  Branches                         [+ New Worktree]         │
├───────────────────────────────────────────────────────────┤
│                                                             │
│  ── Active worktrees ──────────────────────────────────── │
│                                                             │
│  feat/login                       ● 2 runs active          │
│  from: main  ·  5 ahead  ·  dirty                         │
│  [View Git]  [Push]  [Merge →]  [Delete ×]                 │
│                                                             │
│  feat/api                         ● 1 run active           │
│  from: main  ·  2 ahead  ·  clean                         │
│  [View Git]  [Push]  [Merge →]  [Delete ×]                 │
│                                                             │
│  fix/bug                          ✓ all done               │
│  from: main  ·  1 ahead  ·  clean                         │
│  [View Git]  [Push]  [Merge →]  [Delete ×]                 │
│                                                             │
└───────────────────────────────────────────────────────────┘
```

**Worktree card fields**:
- Branch name (large)
- Base branch + commits ahead + clean/dirty
- Status badge: `●` active runs, `✓` idle, `⊘` failed runs
- Action buttons: View Git | Push | Merge → | Delete ×

**[View Git]**: switches the center area to a Git diff view for that worktree's path (same as Git panel from `07-git-panel.md` but scoped to the worktree).

**[Push]**: calls `POST /api/projects/{id}/github/push` for this worktree's branch. Shows push result inline.

**[Merge →]**: opens the inline Merge panel below the card (see Merge Flow).

**[Delete ×]**: confirmation dialog, then `DELETE /api/projects/{id}/worktrees/{id}`.

---

### Merge Flow (inline in Branches tab)

Clicking `[Merge →]` on a worktree card expands an inline merge panel:

```
  Merge feat/login
  ─────────────────────────────────────────────────────
  Into:   [main ▾]

  Strategy:
  ○ Merge commit    (git merge --no-ff)
  ● Squash merge    (git merge --squash + commit)

  Commit message:
  ┌────────────────────────────────────────────────┐
  │ feat: add login page with OAuth support         │
  └────────────────────────────────────────────────┘
  (auto-filled from last commit message on branch)

  [x]  Delete worktree after merge

           [Cancel]  [Merge]
```

**Behavior**:
- `Into` branch: dropdown of local branches, default `main` (or detected default branch)
- Strategy: squash is default (cleaner history for AI-generated work)
- Commit message: pre-filled from the branch's last commit message
- `[x] Delete worktree after merge`: if checked, deletes the worktree and branch after successful merge
- On success: run navigator updates, merged worktree disappears (if delete checked), a success toast shows

**API endpoint**:
```
POST /api/projects/{id}/git/merge
{
  "source_branch": "feat/login",
  "target_branch": "main",
  "strategy": "squash",
  "message": "feat: add login page with OAuth support",
  "delete_worktree_after": true,
  "worktree_id": "wt-feat-login-a3f2b1"
}
→ {
    "ok": true,
    "merge_commit": "d4e5f6a",
    "worktree_deleted": true
  }
```

**Merge errors**:
- `409 merge_conflict` — conflicts detected. Show: "Merge conflict in N files. Resolve manually." with list of conflicted files.
- `400 active_runs` — there are active runs on the source branch. Warn: "Branch has active runs. Cancel them before merging."

---

### Tab: Review

Entry point to code dependency graph. Same as original spec.

```
  Code Review

  Understand your project's dependency structure
  and the blast radius of any file change.

  [Open Dependency Graph →]
```

Navigates to `/projects/[id]/review` (full-screen ReactFlow page — unchanged from original spec).

---

## Page: `/projects/[id]/review`

Unchanged from original spec. See "Code Review API" section in original `02-project-ide.md`.

---

## Zustand Store: IDE State

```typescript
interface IDEStore {
  projectId: string | null

  // Left panel mode
  leftMode: "runs" | "files"
  setLeftMode: (mode: "runs" | "files") => void

  // File tree
  expandedDirs: Set<string>
  toggleDir: (path: string) => void

  // Center area mode
  centerMode: "overview" | "terminal" | "editor"
  focusedRunId: string | null        // which run terminal is shown
  focusRun: (runId: string) => void
  showOverview: () => void

  // Open file editor tabs
  openFiles: string[]
  activeFile: string | null
  openFile: (path: string) => void
  closeFile: (path: string) => void

  // Right panel
  activeRightTab: "launch" | "branches" | "review"
  setActiveRightTab: (tab: RightTab) => void
  rightPanelVisible: boolean
  toggleRightPanel: () => void

  // Selected worktree (affects file tree root and editor paths)
  selectedWorktreePath: string | null
  setSelectedWorktreePath: (path: string | null) => void

  // Merge UI state (per worktree)
  expandedMergePanel: string | null  // worktree_id of open merge panel
  setMergePanel: (id: string | null) => void
}
```

---

## Multiple Terminals — Implementation Note

The user runs many things in parallel. Each run has its own xterm.js instance and WebSocket connection.

**Strategy**: All terminal instances are mounted in a hidden container on page load. Only the focused one is `display: block`. This avoids the cost of destroying/recreating xterm.js + WebSocket on every switch.

```typescript
// In the DOM:
<div id="terminals">
  {allRunIds.map(id => (
    <div key={id} style={{ display: focusedRunId === id ? 'block' : 'none' }}>
      <TerminalPane runId={id} />
    </div>
  ))}
</div>
```

Each `TerminalPane` manages its own WebSocket. Active runs: streaming WS. Completed runs: static replay (no WS).

---

## API Additions (not in other specs)

### `POST /api/run/raw`
Launch an interactive Claude session (no `--print`, no stream-json).

**Request**:
```json
{
  "project_id": "my-app-a3f2b1",
  "worktree_id": null,
  "skip_permissions": false
}
```

**Backend**: Spawns `claude [--dangerously-skip-permissions]` in a PTY. No prompt injection, no effort prefix, no `/rename` — just raw Claude.

**Response**: `{ "run_id": "raw-a3f2b1c4" }`

---

### `POST /api/projects/{id}/git/merge`
Merge a branch into a target branch.

```json
{
  "source_branch": "feat/login",
  "target_branch": "main",
  "strategy": "squash",
  "message": "feat: add login page",
  "delete_worktree_after": true,
  "worktree_id": "wt-feat-login-a3f2b1"
}
```

**Response**: `{ "ok": true, "merge_commit": "d4e5f6a", "worktree_deleted": true }`

---

### File API (defined in spec 01, consumed here)

The editor and file tree use the following endpoints from spec 01:

- `GET /api/projects/{id}/file-tree?worktree_path={path}` — populate the Files mode tree
- `GET /api/projects/{id}/file?path={rel}&worktree_path={path}` — load file into editor
- `PUT /api/projects/{id}/file` — auto-save on blur

When a worktree is selected in the Launch tab controls bar, `selectedWorktreePath` in the IDE store is updated, and all file tree and editor calls pass that value as `worktree_path`.

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `ProjectIDEPage` | `app/(app)/projects/[id]/page.tsx` | Root layout orchestrator |
| `RunNavigator` | `components/project/RunNavigator.tsx` | Left panel: runs grouped by worktree |
| `RunGroupHeader` | `components/project/RunGroupHeader.tsx` | Worktree group: name, status, merge + delete actions |
| `RunCard` | `components/project/RunCard.tsx` | Single run: cmd, time, cost, phase — clickable |
| `FileTree` | `components/project/FileTree.tsx` | Files mode in left panel — uses GET /api/projects/{id}/file-tree |
| `ProjectOverview` | `components/project/ProjectOverview.tsx` | Default center: git summary, active runs, recent runs, worktrees |
| `TerminalPane` | `components/terminal/TerminalPane.tsx` | xterm.js + WS — mounted lazily, shown/hidden |
| `RunHeader` | `components/terminal/RunHeader.tsx` | Terminal header bar |
| `PhaseBar` | `components/terminal/PhaseBar.tsx` | Live tool use display |
| `RawTerminalPane` | `components/terminal/RawTerminalPane.tsx` | Interactive Claude terminal (no stream-json) |
| `LaunchTab` | `components/project/LaunchTab.tsx` | Right panel: `/cmd` input + autocomplete + controls + raw terminal button |
| `BranchesTab` | `components/project/BranchesTab.tsx` | Right panel: worktrees + merge panel |
| `WorktreeCard` | `components/project/WorktreeCard.tsx` | Branch name, status, action buttons |
| `MergePanel` | `components/project/MergePanel.tsx` | Inline merge form: strategy, target, message, delete checkbox |
| `EditorPanel` | `components/project/EditorPanel.tsx` | CodeMirror file editor with tabs, uses File API |
| `DependencyGraph` | `components/project/DependencyGraph.tsx` | ReactFlow full-screen graph `/[id]/review` |
| `ImpactPanel` | `components/project/ImpactPanel.tsx` | Blast radius display below graph |

---

## Acceptance Criteria

**Run Navigator**
- Given I open a project, Then the left panel shows all active runs grouped by worktree branch
- Given a run is active, Then its phase updates live (from stream-json)
- Given I click a run card, Then the center area shows that run's terminal
- Given I click the `[✕]` on the terminal header, Then the center returns to Overview
- Given two runs are active in different worktrees, Then both appear in the navigator and I can switch between them without reconnection

**Project Overview**
- Given I open a project and click no run, Then the Overview shows git status, active runs, recent runs, and worktrees
- Given a run completes, Then the Recent Runs section updates within 5s
- Given a worktree has commits ahead, Then a "Merge to main" shortcut appears in the Worktrees section

**Launch**
- Given I type `/` in the command input, Then an autocomplete dropdown shows project commands + native commands
- Given I select a command, Then it is inserted into the input
- Given I click [Run] with a `/stem args` input, Then POST /api/run/command is called with the parsed stem and args
- Given I type plain text without a `/` prefix, Then the [Run] button remains disabled
- Given I click [Open Raw Claude Terminal], Then an interactive Claude session starts in the center area
- Given no commands are installed in the project's `.claude/`, Then the autocomplete shows only native commands with a "No project commands installed. Add from Library →" hint

**Worktree awareness**
- Given I select a worktree in the worktree selector, Then the file tree re-fetches using that worktree's path
- Given I open a file while a worktree is selected, Then the file is read via GET /api/projects/{id}/file with worktree_path set
- Given I save a file while a worktree is selected, Then PUT /api/projects/{id}/file is called with worktree_path set

**Raw Terminal**
- Given a raw terminal is open, Then I can type freely to Claude
- Given I type `/exit`, Then the session ends and the center returns to Overview
- Given the raw session, Then no phase bar is shown (it is a raw interactive session, not stream-json)

**Branches + Merge**
- Given a worktree is shown in the Branches tab, Then View Git / Push / Merge / Delete actions are visible
- Given I click [Merge →], Then an inline merge panel expands below the worktree card
- Given I select squash strategy and click Merge, Then `POST /api/projects/{id}/git/merge` is called
- Given merge succeeds and "Delete worktree after merge" is checked, Then the worktree disappears from the navigator
- Given a merge conflict occurs, Then I see a conflict error with the list of conflicted files
- Given I try to merge a branch with active runs, Then a warning is shown and merge is blocked

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Run Navigator (grouped by worktree, live phase updates) | L |
| Project Overview (center default view) | M |
| Multiple terminal instances (lazy mount, show/hide) | L |
| Raw Claude Terminal mode (interactive PTY, no stream-json) | M |
| LaunchTab (/cmd input only, autocomplete, worktree selector) | M |
| BranchesTab + WorktreeCard (merge + delete actions) | M |
| MergePanel (inline form, strategy, squash, delete-after) | M |
| POST /api/projects/{id}/git/merge (backend) | M |
| POST /api/run/raw (backend, interactive PTY) | M |
| FileTree (left panel files mode — uses GET /api/projects/{id}/file-tree) | M |
| EditorPanel (CodeMirror, tabs, auto-save via File API, worktree_path aware) | L |
| DependencyGraph page (ReactFlow + dagre) | L |
| Zustand IDE store (multi-run state, selectedWorktreePath) | M |
| Mobile layout (bottom nav, single panel) | M |
