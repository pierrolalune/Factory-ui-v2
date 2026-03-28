# Spec 08 — Worktrees

**Domain**: Git
**Location**: Project IDE → Right panel → Worktrees tab
**Sprint**: 5

---

## Overview

Git worktrees allow the user to run Claude Code against a branch in isolation, without disturbing the main working tree. This is the primary mechanism for safely experimenting with AI-generated changes: create a worktree for a feature branch, run agents against it, review the diff, then merge or discard.

This spec covers:
- Worktree list (inside the project IDE)
- Create worktree (new branch or existing branch)
- Delete worktree
- Selecting a worktree as the target for a run (via the Branch selector in the Launch Panel)

---

## Tech Stack

- **Backend**: Python `subprocess` calls to `git worktree` commands
- **Storage**: Worktree metadata stored in `~/.factory-projects/{project_id}/worktrees.json`
- **Frontend**: Right panel tab in Project IDE

---

## Concepts

A **git worktree** is a linked working directory associated with a specific branch. Factory UI creates worktrees inside a dedicated directory:

```
{project_path}/../{project_name}-worktrees/{branch_name}/
```

Example:
- Project path: `/Users/pierre/code/my-app`
- Worktree for branch `feat/login`: `/Users/pierre/code/my-app-worktrees/feat-login/`

The user never needs to know about this directory — Factory UI manages it transparently.

---

## Data Model

### Worktree

```typescript
interface Worktree {
  id: string                  // e.g. "wt-feat-login-a3f2b1"
  project_id: string
  branch: string              // git branch name, e.g. "feat/login"
  path: string                // absolute path to the worktree directory
  base_branch: string         // branch this was created from, e.g. "main"
  created_at: string          // ISO 8601
  is_dirty: boolean           // has uncommitted changes
  ahead: number               // commits ahead of base_branch
  commit_sha?: string         // current HEAD sha (short)
}
```

Storage: `~/.factory-projects/{project_id}/worktrees.json` = `Worktree[]`

---

## API Endpoints

### `GET /api/projects/{id}/worktrees`
List all worktrees for a project.

**Response**: `Worktree[]`

```json
[
  {
    "id": "wt-feat-login-a3f2b1",
    "project_id": "my-app-a3f2b1",
    "branch": "feat/login",
    "path": "/Users/pierre/code/my-app-worktrees/feat-login",
    "base_branch": "main",
    "created_at": "2026-03-28T10:00:00Z",
    "is_dirty": true,
    "ahead": 3,
    "commit_sha": "a3f2b1c"
  }
]
```

---

### `POST /api/projects/{id}/worktrees`
Create a new worktree.

**Request**:
```json
{
  "branch": "feat/login",
  "base_branch": "main",
  "create_branch": true
}
```

- `branch`: the branch name to use. Must be a valid git branch name.
- `base_branch`: branch to create from (only used if `create_branch: true`). Defaults to the project's current HEAD branch.
- `create_branch`: if `true`, creates a new branch. If `false`, checks out an existing branch.

**Behavior**:
1. If `create_branch: true`: runs `git worktree add -b {branch} {worktree_path} {base_branch}`
2. If `create_branch: false`: runs `git worktree add {worktree_path} {branch}`
3. Registers the worktree in `worktrees.json`

**Validation**:
- `branch`: valid git branch name (no spaces, no `..`, etc.)
- If `create_branch: true`: branch must not already exist
- If `create_branch: false`: branch must already exist in the repo

**Response**: `{ "id": "wt-feat-login-a3f2b1", "path": "..." }`

**Errors**:
- `400 branch_exists` — branch already exists (when create_branch: true)
- `400 branch_not_found` — branch doesn't exist (when create_branch: false)
- `400 invalid_branch_name` — invalid git branch name
- `500 disk_full` — `git worktree add` failed with ENOSPC. Message: "Not enough disk space to create worktree."

---

### `DELETE /api/projects/{id}/worktrees/{worktree_id}`
Delete a worktree.

**Behavior**:
1. Runs `git worktree remove {path} --force` (force because Claude may have left files)
2. Removes from `worktrees.json`
3. Optionally deletes the branch: controlled by `delete_branch` query param

**Query params**:
- `delete_branch` (bool, default false): also delete the git branch after removing the worktree

**Errors**:
- `400 has_active_runs` — there are active runs targeting this worktree (must cancel first)

**Response**: `{ "ok": true }`

---

### `GET /api/projects/{id}/branches`
List all branches in the project (for the "create from" selector and the "checkout existing" flow).

**Response**:
```json
{
  "current": "main",
  "local": ["main", "feat/login", "fix/auth-bug"],
  "remote": ["origin/main", "origin/feat/login"]
}
```

---

## UI: Worktrees Tab in Right Panel

**Layout**:
```
┌───────────────────────────────────────────────────────────┐
│  Worktrees                              [+ New Worktree]   │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ── Active Worktrees ──────────────────────────────────── │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  feat/login                                          │ │
│  │  Created from: main                                  │ │
│  │  ● 3 uncommitted changes · 2 commits ahead           │ │
│  │                                     [Git] [Delete ×] │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  fix/auth-bug                                        │ │
│  │  Created from: main                                  │ │
│  │  ✓ Clean                                             │ │
│  │                                     [Git] [Delete ×] │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

**Worktree Card**:
- Branch name (prominent)
- "Created from: {base_branch}"
- Status line:
  - `● N uncommitted changes · N commits ahead` (dirty, amber)
  - `✓ Clean` (green)
- **[Git]** button: opens the Git tab pre-filtered to this worktree's path
- **[Delete ×]** button: confirmation dialog before deletion

---

### Create Worktree Panel

Triggered by `[+ New Worktree]`. Slides in below the header (inline, not a modal).

```
┌───────────────────────────────────────────────────────────┐
│  New Worktree                                   [Cancel ×] │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ○ Create new branch                                       │
│  ● Check out existing branch                               │
│                                                            │
│  Branch name *                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │ feat/login                                         │    │
│  └───────────────────────────────────────────────────┘    │
│                                                            │
│  Create from (base branch)                                 │
│  ┌───────────────────────────────────────────────────┐    │
│  │  main  ▾                                          │    │
│  └───────────────────────────────────────────────────┘    │
│  (only shown when "Create new branch" is selected)        │
│                                                            │
│                                    [Create Worktree]       │
└───────────────────────────────────────────────────────────┘
```

- **Radio**: "Create new branch" vs "Check out existing branch"
- If "Check out existing": branch name field becomes a dropdown of existing local branches
- If "Create new": branch name is a free text input + base branch selector
- Base branch dropdown: list of local branches from `GET /api/projects/{id}/branches`
- [Create Worktree] disabled until branch name is filled

---

### Delete Worktree Confirmation

```
Delete worktree feat/login?

This will remove the worktree directory and its uncommitted changes.
The git branch "feat/login" will be kept.

[Delete branch too]  [Cancel]  [Delete Worktree]
```

- "Delete branch too" checkbox: controls `delete_branch` query param
- Red destructive styling on [Delete Worktree]

---

### Integration with Launch Panel

The Branch selector in the Launch Panel (see `03-run-execution.md`) shows:
- "main" (the project root)
- Each worktree's branch name

When a worktree branch is selected, the run's `cwd` is set to the worktree's `path` instead of the project root.

The Branch selector is populated by `GET /api/projects/{id}/worktrees`.

---

## States

| State | Display |
|---|---|
| Loading | Skeleton cards |
| No worktrees | "No worktrees yet. Create one to run agents in isolation." |
| Creating in progress | Create button shows spinner, form disabled |
| Deleting in progress | Delete button shows spinner, card grayed out |
| Create error (branch exists) | Inline error "Branch 'feat/login' already exists" |
| Create error (disk full) | Inline error "Not enough disk space to create worktree." |

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `WorktreesPanel` | `components/project/WorktreesPanel.tsx` | Tab content with list + create form |
| `WorktreeCard` | `components/project/WorktreeCard.tsx` | Single worktree: branch, status, actions |
| `CreateWorktreeForm` | `components/project/CreateWorktreeForm.tsx` | Inline create form |
| `DeleteWorktreeDialog` | `components/project/DeleteWorktreeDialog.tsx` | Confirmation dialog |

**TanStack Query hooks**:
- `useWorktrees(projectId)` — GET worktrees
- `useCreateWorktree(projectId)` — POST worktree
- `useDeleteWorktree(projectId)` — DELETE worktree
- `useBranches(projectId)` — GET branches (for dropdowns)

---

## Acceptance Criteria

**List**
- Given a project has worktrees, When I open the Worktrees tab, Then all worktrees are shown as cards
- Given a worktree has uncommitted changes, Then the card shows an amber status with the count
- Given a worktree is clean, Then the card shows a green "Clean" status
- Given no worktrees exist, Then an empty state with a "Create one" prompt is shown

**Create**
- Given I select "Create new branch" and enter "feat/login", Then a new git branch and worktree are created
- Given I select "Check out existing branch" and pick "fix/auth-bug", Then a worktree for that branch is created
- Given I try to create a branch that already exists, Then an inline error appears
- Given I enter an invalid branch name (e.g. with spaces), Then the form shows a validation error
- Given the disk is full when creating a worktree, Then an inline error "Not enough disk space to create worktree." is shown

**Delete**
- Given I click Delete on a worktree, Then a confirmation dialog appears with the branch name
- Given I confirm without "Delete branch too", Then the worktree directory is removed but the branch remains
- Given I confirm with "Delete branch too", Then both the worktree and the git branch are deleted
- Given the worktree has an active run, Then deletion is blocked with an error message

**Launch Panel integration**
- Given a project has worktrees, When I open the Branch selector in the Launch Panel, Then all worktree branches appear as options
- Given I select a worktree branch and click Run, Then the run executes with that worktree's path as cwd

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: worktree service (git worktree add/remove, ENOSPC handling) | M |
| Backend: GET/POST/DELETE worktree endpoints | M |
| Backend: GET /api/projects/{id}/branches | S |
| Backend: worktrees.json storage | S |
| Frontend: WorktreesPanel + WorktreeCard | M |
| Frontend: CreateWorktreeForm (radio, branch selector, disk full error) | M |
| Frontend: DeleteWorktreeDialog | S |
| Frontend: Branch selector in LaunchPanel (from worktrees list) | S |
