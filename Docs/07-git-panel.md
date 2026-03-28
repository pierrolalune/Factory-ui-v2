# Spec 07 — Git Panel

**Domain**: Git
**Location**: Project IDE → Right panel → Git tab
**Sprint**: 5

---

## Overview

The Git Panel lives inside the Project IDE's right panel. It gives the user a fast, focused view of their project's git status — what changed, what's staged, and the ability to commit. It is designed for the "review what the AI changed and commit it" workflow, not for complex branching or history browsing.

This spec covers:
- File change list (modified, untracked, staged)
- Inline diff viewer
- Stage / unstage actions
- Commit with message
- Current branch indicator and recent commits

---

## Tech Stack

- **Backend**: Python `subprocess` calls to the local `git` binary
- **Frontend**: Next.js, TanStack Query, custom diff renderer

---

## Data Model

### GitStatus

```typescript
interface GitStatus {
  branch: string              // current branch name, e.g. "main" or "feat/login"
  is_dirty: boolean           // any uncommitted changes
  staged: GitFileChange[]     // files in the index (staged)
  unstaged: GitFileChange[]   // modified/deleted tracked files (not staged)
  untracked: string[]         // untracked file paths
  ahead: number               // commits ahead of remote
  behind: number              // commits behind remote
}

type ChangeType = "modified" | "added" | "deleted" | "renamed"

interface GitFileChange {
  path: string                // relative path from project root
  change_type: ChangeType
  old_path?: string           // only for renamed files
}
```

### GitDiff

```typescript
interface GitDiff {
  file_path: string
  is_staged: boolean
  is_binary: boolean          // true if the file is binary — hunks will be empty
  hunks: DiffHunk[]
}

interface DiffHunk {
  header: string              // e.g. "@@ -12,7 +12,9 @@"
  lines: DiffLine[]
}

interface DiffLine {
  type: "context" | "add" | "remove"
  content: string
  old_line_no?: number
  new_line_no?: number
}
```

### GitCommit (recent history)

```typescript
interface GitCommit {
  hash: string          // short hash (7 chars)
  message: string       // first line of commit message
  author: string        // author name
  date: string          // ISO 8601
}
```

---

## API Endpoints

All endpoints accept an optional `worktree_path` parameter. When provided, git operations run against that worktree instead of the project root.

### `GET /api/projects/{id}/git/status`
Returns the current git status of the project (or a specific worktree).

**Query params**:
- `worktree_path` (optional): absolute path to a worktree. Defaults to the project root.

**Response**: `GitStatus`

```json
{
  "branch": "feat/auth-refactor",
  "is_dirty": true,
  "staged": [
    { "path": "src/auth.ts", "change_type": "modified" }
  ],
  "unstaged": [
    { "path": "src/utils.ts", "change_type": "modified" }
  ],
  "untracked": ["src/auth.test.ts"],
  "ahead": 0,
  "behind": 0
}
```

---

### `GET /api/projects/{id}/git/diff`
Get the diff for a specific file.

**Query params**:
- `path`: file path (relative to project root)
- `staged`: `true` | `false` — staged diff (index vs HEAD) or unstaged diff (working tree vs index)
- `worktree_path` (optional): absolute path to a worktree

**Response**: `GitDiff`

**Binary file handling**: If the file is binary (detected by null bytes in the first 8KB or by extension: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`, `.woff`, `.woff2`, `.ttf`, `.eot`, `.otf`, `.pdf`, `.zip`, `.gz`, `.tar`, `.mp4`, `.mp3`, `.wav`), the response sets `is_binary: true` and returns an empty `hunks` array.

---

### `POST /api/projects/{id}/git/stage`
Stage files.

**Request**:
```json
{
  "paths": ["src/auth.ts", "src/utils.ts"],
  "worktree_path": null
}
```

Use `paths: ["."]` to stage all changes.

**Response**: `{ "ok": true }`

---

### `POST /api/projects/{id}/git/unstage`
Unstage files (reset HEAD).

**Request**:
```json
{
  "paths": ["src/auth.ts"],
  "worktree_path": null
}
```

**Response**: `{ "ok": true }`

---

### `POST /api/projects/{id}/git/commit`
Create a commit from staged changes.

**Request**:
```json
{
  "message": "feat: refactor auth module to use session service",
  "worktree_path": null
}
```

**Validation**:
- `message`: required, 1–500 chars
- Must have staged changes (returns `400 nothing_staged` otherwise)

**Response**: `{ "hash": "a3f2b1c", "message": "feat: refactor auth module..." }`

---

### `GET /api/projects/{id}/git/log`
Recent commit history.

**Query params**:
- `limit` (default 10)
- `worktree_path` (optional): absolute path to a worktree

**Response**: `GitCommit[]`

---

### `POST /api/projects/{id}/git/discard`
Discard changes to unstaged files (checkout -- <path>).

**Request**:
```json
{
  "paths": ["src/utils.ts"],
  "worktree_path": null
}
```

**Warning**: This is destructive — discarded changes cannot be recovered.

**Response**: `{ "ok": true }`

---

## UI: Git Tab in Right Panel

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│  Git                                                     │
│  ⎇  feat/auth-refactor                [Refresh]          │
├────────────────────────────────────────────────────────┤
│                                                          │
│  ── Staged (1) ──────────────────── [Unstage All]        │
│  ☑  M  src/auth.ts                          [diff ▾]    │
│                                                          │
│  ── Unstaged (2) ────────────────── [Stage All]          │
│  ☐  M  src/utils.ts                         [diff ▾]    │
│  ☐  ?  src/auth.test.ts                     [diff ▾]    │
│                                                          │
│  ── Commit ──────────────────────────────────────────── │
│  ┌──────────────────────────────────────────────────┐   │
│  │ feat: refactor auth module                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                    [Commit (1 file)]     │
│                                                          │
│  ── Recent Commits ──────────────────────────────────── │
│  a3f2b1c  fix: session service typing  2h ago            │
│  b4c3d2e  feat: add session service    3h ago            │
│  c5d4e3f  chore: cleanup utils         Yesterday         │
└────────────────────────────────────────────────────────┘
```

---

### Section: Staged Files

Shows files in the git index. Each row:
- Checkbox (checked = staged, always checked in this section)
- Change type indicator: `M` (modified), `A` (added), `D` (deleted), `R` (renamed)
- File path (relative, truncated with tooltip)
- `[diff ▾]` button — expands inline diff viewer below the row

Clicking the checkbox calls `POST /api/projects/{id}/git/unstage`.

**[Unstage All]** button: unstages all staged files.

---

### Section: Unstaged / Untracked Files

Shows modified tracked files + untracked files. Each row:
- Checkbox (unchecked = not staged)
- Change indicator: `M`, `?` (untracked), `D`
- File path
- `[diff ▾]` button (only for modified files — untracked show as entirely new)
- `[discard ×]` icon (only for modified tracked files) — destructive, requires confirmation

Clicking a checkbox calls `POST /api/projects/{id}/git/stage` for that file.

**[Stage All]** button: stages all unstaged + untracked files.

---

### Inline Diff Viewer

Expands below a file row when `[diff ▾]` is clicked.

**Text files**:
```
src/auth.ts
─────────────────────────────────────────────────────────
 @@ -12,7 +12,9 @@
   import { Session } from './session'
 - import { OldAuth } from './old-auth'
 + import { AuthService } from './auth-service'
 + import { SessionService } from './session-service'

   export function createAuth() {
─────────────────────────────────────────────────────────
```

- Line-by-line diff rendering
- Added lines: green background (`rgba(94, 207, 58, 0.15)`)
- Removed lines: red background (`rgba(239, 68, 68, 0.15)`)
- Context lines: no background
- Monospace font, line numbers on both sides
- Max height 400px, scrollable
- Click `[diff ▾]` again to collapse

**Binary files**: When `GitDiff.is_binary` is `true`, the diff viewer shows the message "Binary file — cannot display diff" in place of diff content. No hunk rendering is attempted.

---

### Commit Section

- Single-line text input for commit message
- Placeholder: "Commit message"
- `[Commit (N file)]` button: disabled if no staged files or no commit message
- N = count of staged files
- On success: git status refreshes, recent commits updates, commit message clears

---

### Section: Recent Commits

Last 10 commits (short format):
```
a3f2b1c  feat: refactor auth module to use session service  2h ago
b4c3d2e  fix: session service type error                    3h ago
```

- Short hash (monospace, muted)
- First line of commit message
- Relative timestamp
- Not clickable in MVP

---

## States

| State | Display |
|---|---|
| Loading status | Skeleton rows |
| Clean working tree | "Nothing to commit. Working tree clean." |
| Not a git repo | "This project is not a git repository." (with instructions to init) |
| Git binary not found | "git not found. Make sure git is installed and in PATH." |
| Commit in progress | Submit button shows spinner, inputs disabled |
| Commit success | Brief success toast "Committed: {hash}" |
| Commit error | Inline error below message field |

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `GitPanel` | `components/project/GitPanel.tsx` | Main git tab content |
| `GitFileList` | `components/project/GitFileList.tsx` | Staged or unstaged file list section |
| `GitFileRow` | `components/project/GitFileRow.tsx` | Single file row with checkbox, badge, diff toggle |
| `InlineDiffViewer` | `components/project/InlineDiffViewer.tsx` | Expandable diff display — handles binary guard |
| `DiffHunk` | `components/project/DiffHunk.tsx` | Renders a single diff hunk |
| `CommitForm` | `components/project/CommitForm.tsx` | Commit message input + submit button |
| `RecentCommits` | `components/project/RecentCommits.tsx` | Recent commit history list |

**TanStack Query hooks**:
- `useGitStatus(projectId, worktreePath?)` — GET /api/projects/{id}/git/status, refetch on focus
- `useGitDiff(projectId, filePath, staged, worktreePath?)` — GET /api/projects/{id}/git/diff, lazy
- `useStageFiles(projectId)` — POST stage
- `useUnstageFiles(projectId)` — POST unstage
- `useCommit(projectId)` — POST commit
- `useDiscardChanges(projectId)` — POST discard
- `useGitLog(projectId, worktreePath?)` — GET git log

---

## Acceptance Criteria

**File list**
- Given I open the Git tab, Then I see staged files, unstaged files, and untracked files in separate sections
- Given a file is staged, Then its checkbox is checked and it appears in the Staged section
- Given I uncheck a staged file, Then it moves to the Unstaged section
- Given I check an unstaged file, Then it moves to the Staged section
- Given I click [Stage All], Then all unstaged and untracked files become staged

**Diff viewer**
- Given I click `[diff ▾]` on a modified text file, Then an inline diff expands below it
- Given I click `[diff ▾]` again, Then the diff collapses
- Given the diff has additions, Then those lines have a green background
- Given the diff has removals, Then those lines have a red background
- Given I click `[diff ▾]` on a binary file (e.g. a .png), Then the viewer shows "Binary file — cannot display diff"

**Commit**
- Given there are staged files and a commit message, Then the Commit button is enabled
- Given I click Commit, Then a commit is created and the staged list clears
- Given commit succeeds, Then the recent commits list updates to show the new commit at the top
- Given there are no staged files, Then the Commit button is disabled

**Discard**
- Given I click the discard icon on an unstaged file, Then a confirmation dialog appears
- Given I confirm the discard, Then the file's changes are reverted

**worktree_path**
- Given the Git tab is opened for a worktree, Then all status/diff/stage/commit/log calls include the worktree_path

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: git status endpoint | M |
| Backend: git diff endpoint (parse unified diff → hunks, binary detection) | L |
| Backend: stage / unstage / commit / discard endpoints | M |
| Backend: git log endpoint | S |
| Frontend: GitPanel layout + section headers | M |
| Frontend: GitFileRow + checkbox + diff toggle | M |
| Frontend: InlineDiffViewer + DiffHunk + binary guard | L |
| Frontend: CommitForm | S |
| Frontend: RecentCommits | S |
| Frontend: discard confirmation flow | S |
