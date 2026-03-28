# Spec 01 — Project Management

**Domain**: Project
**Route**: `/projects`, `/projects/new`
**Sprint**: 1

---

## Overview

A project is a local directory registered in Factory UI. It is the root context for all runs, git operations, worktrees, and history. Factory UI never modifies project files directly except through Claude CLI runs and the explicit File API (CLAUDE.md writing, editor auto-save).

This spec covers:
- The project registry (list, create, update, delete)
- The `/projects` browser page
- The `/projects/new` creation wizard — including:
  - **Disk browser**: browse or discover project directories from the filesystem
  - **Git init**: if the directory has no git repo, initialize one automatically
  - **CLAUDE.md generation**: optionally generate a `CLAUDE.md` from the project description using Claude in stateless mode (one-shot, no session)
- The **File API**: read file tree, read file, write file — used by the editor and CLAUDE.md writing

It does NOT cover the project IDE panels or run execution — see `02-project-ide.md` and `03-run-execution.md`.

---

## Tech Stack

- **Backend**: FastAPI, Python 3.11+
- **Storage**: `~/.factory-cli-projects.json` (flat JSON array of all projects)
- **Per-project data**: `~/.factory-projects/{project_id}/` directory
- **Frontend**: Next.js 15 App Router, TypeScript, TanStack Query, Zustand, Tailwind CSS 4

---

## Data Model

### Project

```typescript
interface Project {
  id: string            // e.g. "my-app-a3f2b1" — slug + 6-char hash
  name: string          // display name, e.g. "My App"
  path: string          // absolute local path, e.g. "/Users/pierre/code/my-app"
  description?: string  // optional short description
  github_remote?: string // e.g. "git@github.com:user/repo.git"
  created_at: string    // ISO 8601
  last_run_at?: string  // ISO 8601 — updated on each run completion
}
```

Storage: `~/.factory-cli-projects.json` = `Project[]`

### Project Config

Stored per-project in `~/.factory-projects/{id}/config.json`:

```typescript
interface ProjectConfig {
  project_id: string
  default_effort?: "low" | "medium" | "high" | "max"
  skip_permissions_default?: boolean
}
```

### ProjectSummary (list response — includes run stats)

```typescript
interface ProjectSummary extends Project {
  active_run_count: number
  last_run_status?: "completed" | "failed" | "cancelled"
  last_run_cost_usd?: number
}
```

### PathInfo (returned by validate-path)

```typescript
interface PathInfo {
  exists: boolean
  already_registered: boolean
  existing_project_id?: string   // if already registered
  is_git_repo: boolean           // true if .git/ exists
  has_claude_md: boolean         // true if CLAUDE.md exists at root
  suggested_name?: string        // derived from directory name
  detected_stack?: string[]      // e.g. ["Node.js", "TypeScript"] from package.json scan
}
```

### DirectoryEntry (for disk browser)

```typescript
interface DirectoryEntry {
  name: string
  path: string              // absolute path
  is_project_candidate: boolean  // true if contains .git, package.json, requirements.txt, etc.
  children_count: number    // number of subdirectories (for pagination hint)
}
```

### FileNode (for file tree)

```typescript
interface FileNode {
  name: string
  path: string                        // relative path from project root (or worktree root)
  type: "file" | "directory"
  children?: FileNode[]               // present only for directories
  size?: number                       // bytes, present only for files
}
```

---

## API Endpoints

### `GET /api/projects`
List all registered projects with run summary data.

**Response**: `ProjectSummary[]`

---

### `GET /api/projects/validate-path`
Validate a path before project creation. Called on blur of the path field.

**Query params**: `path` (absolute path)

**Response**: `PathInfo`

```json
{
  "exists": true,
  "already_registered": false,
  "is_git_repo": false,
  "has_claude_md": false,
  "suggested_name": "my-app",
  "detected_stack": ["Node.js", "TypeScript", "React"]
}
```

**Stack detection logic**:
- `package.json` → Node.js; check `dependencies` for React, Vue, Next.js, etc.
- `requirements.txt` / `pyproject.toml` → Python
- `Cargo.toml` → Rust
- `go.mod` → Go
- `pom.xml` / `build.gradle` → Java

---

### `GET /api/system/browse`
Browse filesystem directories. Powers the disk browser UI.

**Query params**:
- `path` (required): directory to list. Use `~` for home directory.
- `show_hidden` (bool, default false)

**Response**:
```json
{
  "current_path": "/Users/pierre",
  "parent_path": "/Users",
  "entries": [
    {
      "name": "code",
      "path": "/Users/pierre/code",
      "is_project_candidate": false,
      "children_count": 12
    },
    {
      "name": "my-app",
      "path": "/Users/pierre/my-app",
      "is_project_candidate": true,
      "children_count": 5
    }
  ]
}
```

**Errors**:
- `400 not_a_directory` — path exists but is a file
- `400 path_not_found`

---

### `GET /api/system/discover-projects`
Scan common locations for project candidates. Used for the "Discover" feature.

**Query params**:
- `base_path` (optional): directory to scan. Defaults to home directory.
- `depth` (default 2): how deep to recurse.

**Candidate criteria**: directory contains at least one of: `.git`, `package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`.

**Response**:
```json
{
  "candidates": [
    {
      "name": "my-app",
      "path": "/Users/pierre/code/my-app",
      "is_project_candidate": true,
      "children_count": 8,
      "detected_stack": ["Node.js", "TypeScript"]
    }
  ]
}
```

Already-registered projects are excluded from results.

---

### `POST /api/projects`
Register a new project. Optionally initializes a git repo.

**Request body**:
```json
{
  "name": "My App",
  "path": "/Users/pierre/code/my-app",
  "description": "Main product repo",
  "github_remote": "git@github.com:user/my-app.git",
  "init_git": true
}
```

**`init_git` behavior** (only used if `is_git_repo: false`):
1. Runs `git init` in the project directory
2. Runs `git add -A`
3. Runs `git commit -m "Initial commit"`

If `init_git: true` but the directory is already a git repo → silently ignored.

**Validation**:
- `name`: required, 1–64 chars
- `path`: required, must exist on disk, must not already be registered
- `github_remote`: optional, validated as a valid git remote URL if present

**Response**: `{ "id": "my-app-a3f2b1", "git_initialized": true }`

**Errors**:
- `400 path_not_found`
- `409 already_registered`
- `500 git_init_failed` — git init ran but failed (git not installed, permission error, etc.)

---

### `POST /api/projects/{id}/setup/generate-claude-md`
Generate a `CLAUDE.md` for the project using Claude in stateless mode.

**What "stateless mode" means here**: a blocking one-shot call — `claude --print "{prompt}"` — with no session, no PTY, no WebSocket. The backend waits for the response (up to 60s) and returns the generated content as a string.

**Request body**:
```json
{
  "description": "A Next.js 15 app with FastAPI backend for managing Claude Code runs",
  "scan_project": true
}
```

**`scan_project: true` behavior**: Before calling Claude, the backend reads:
- `README.md` (first 2000 chars)
- `package.json` or `requirements.txt` or `pyproject.toml` (full content)
- Root directory listing (file names only)

These are injected into the prompt as context.

**Prompt sent to Claude**:
```
Generate a CLAUDE.md file for a software project.

Project name: {name}
Description: {description}

Project context:
{scanned_files_content}

The CLAUDE.md should include:
- Project overview (what it is, what it does)
- Tech stack and key dependencies
- How to run the project (dev server, tests)
- Architecture overview (key directories and their purpose)
- Key conventions and patterns the AI should follow
- Any important constraints or gotchas

Keep it concise and practical. Use markdown headers.
```

**Response**:
```json
{
  "content": "# My App\n\nA Next.js 15 app...\n\n## Tech Stack\n...",
  "model": "claude-sonnet-4-6",
  "tokens_used": 1840
}
```

**This does NOT write the file.** The frontend shows a preview and the user must confirm before writing. Writing is done via `PUT /api/projects/{id}/file` (see below).

**Timeout**: 60 seconds. If Claude takes longer, return `504 generation_timeout`.

---

### `GET /api/projects/{id}`
Fetch one project.

**Response**: `ProjectSummary`

---

### `PATCH /api/projects/{id}`
Update project metadata (name, description, github_remote).

Note: `path` cannot be changed after creation.

---

### `DELETE /api/projects/{id}`
Remove from registry. Does NOT delete files on disk. Terminates active runs first.

---

### `GET /api/projects/{id}/config` / `PATCH /api/projects/{id}/config`
Read/update default effort and skip-permissions settings.

---

### `GET /api/projects/{id}/file-tree`
Return the recursive file tree for the project (or a specific worktree).

Excludes: `.git`, `node_modules`, `.venv`, `__pycache__`, `dist`, `build`.

**Query params**:
- `worktree_path` (optional, absolute path): if set, tree is rooted at this worktree path instead of the project root

**Response**: `FileNode[]`

```json
[
  {
    "name": "src",
    "path": "src",
    "type": "directory",
    "children": [
      { "name": "index.ts", "path": "src/index.ts", "type": "file", "size": 1240 },
      { "name": "auth.ts",  "path": "src/auth.ts",  "type": "file", "size": 3820 }
    ]
  },
  { "name": "README.md", "path": "README.md", "type": "file", "size": 980 }
]
```

Paths are relative to the root used (project root or worktree path).

---

### `GET /api/projects/{id}/file`
Read a single file. Maximum file size: 1 MB.

**Query params**:
- `path` (required, relative): path relative to project root (or worktree root)
- `worktree_path` (optional, absolute path): if set, resolves `path` relative to this worktree

**Response**:
```json
{
  "content": "import React from 'react';\n...",
  "size": 3820
}
```

**Errors**:
- `400 file_too_large` — file exceeds 1 MB
- `404 file_not_found` — path does not exist or is a directory

---

### `PUT /api/projects/{id}/file`
Write a file. Creates the file if it does not exist; overwrites if it does.

Used for: CLAUDE.md writing from the creation wizard, editor auto-save.

**Request body**:
```json
{
  "path": "CLAUDE.md",
  "content": "# My App\n\n...",
  "worktree_path": null
}
```

- `path`: relative path from project root (or worktree root)
- `worktree_path`: if set, writes into this worktree path instead of project root

**Response**: `{ "ok": true }`

**Errors**:
- `400 path_outside_project` — resolved path escapes the project/worktree directory (path traversal guard)
- `400 is_directory` — path points to an existing directory

---

## Pages

### `/projects` — Projects Browser

**Purpose**: Entry point. Shows all projects at a glance.

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar  │  Projects                        [+ New Project]    │
│           ├─────────────────────────────────────────────────────┤
│           │                                                      │
│           │  ┌────────────────┐  ┌────────────────┐            │
│           │  │  My App        │  │  Factory UI     │            │
│           │  │  ~/code/my-app │  │  ~/Desktop/...  │            │
│           │  │  2h ago · $0.12│  │  ● Running      │            │
│           │  └────────────────┘  └────────────────┘            │
│           │                                                      │
│           │  ┌────────────────┐                                  │
│           │  │  Blog          │                                  │
│           │  │  ~/code/blog   │                                  │
│           │  │  Never run     │                                  │
│           │  └────────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Project Card** content:
- Name (large, `#dce8f5`)
- Truncated path (muted, `#8299b8`)
- Status line:
  - `● Running` — pulsing lime green dot (color: `#5ecf3a`)
  - `2h ago · $0.12` — last run time + cost
  - `Never run` — muted
- Click → navigate to `/projects/{id}`

**Grid columns**: 3 / 2 / 1 at 1280+ / 768–1279 / <768px

---

### `/projects/new` — Create Project Wizard

The creation flow is a **2-step wizard**:
- **Step 1**: Pick a directory (type path, browse filesystem, or discover)
- **Step 2**: Configure project details + optional setup (git init, CLAUDE.md)

---

#### Step 1 — Pick Directory

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar  │  New Project  (1 of 2)                               │
│           ├─────────────────────────────────────────────────────┤
│           │                                                      │
│           │  Where is your project?                              │
│           │                                                      │
│           │  ┌──────────────────────────────────────┐  [Browse] │
│           │  │ /Users/pierre/code/my-app             │           │
│           │  └──────────────────────────────────────┘           │
│           │  Node.js · TypeScript · React  (detected stack)     │
│           │  Path not found on disk        (inline error)       │
│           │                                                      │
│           │  ── Or discover projects ──────────────────────────  │
│           │  [Scan ~/code]  [Scan ~/Desktop]  [Scan ~]           │
│           │                                                      │
│           │  my-app           ~/code/my-app    Node.js           │
│           │  factory-ui       ~/Desktop/...    Python + TS       │
│           │  blog             ~/code/blog      Next.js           │
│           │                                                      │
│           │                              [Cancel]  [Next →]      │
└─────────────────────────────────────────────────────────────────┘
```

**Path input behavior**:
- On blur: calls `GET /api/projects/validate-path`
- On success: shows detected stack as a green pill line below the input
- On error: inline error message

**[Browse] button**: opens the Disk Browser panel (see below).

**Discover section**:
- Quick-scan buttons for common locations: `~/code`, `~/Desktop`, `~/`
- Clicking a scan button calls `GET /api/system/discover-projects?base_path=...`
- Results appear as a compact list: name, path, detected stack
- Clicking a row fills the path input and fires validation
- Already-registered projects are excluded

**[Next →]** button: disabled until path is filled and validation passes.

---

#### Disk Browser Panel

Opens as a slide-over from the right when [Browse] is clicked.

```
┌───────────────────────────────────────────────────────────┐
│  Browse Filesystem                              [× Close]  │
├───────────────────────────────────────────────────────────┤
│  /Users/pierre                                             │
│  ← Up                                                      │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  [dir]  code/                    (12 dirs)   ● projects   │
│  [dir]  Desktop/                 (4 dirs)                  │
│  [dir]  Documents/               (8 dirs)                  │
│  [dir]  Downloads/               (3 dirs)                  │
│                                                            │
├───────────────────────────────────────────────────────────┤
│                            [Select This Directory]         │
└───────────────────────────────────────────────────────────┘
```

- `● projects` tag: shown next to directories that are project candidates
- Clicking a directory: navigates into it (calls `GET /api/system/browse?path=...`)
- `← Up`: goes to parent directory
- `[Select This Directory]`: confirms selection, fills path input, closes panel

---

#### Step 2 — Configure

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar  │  New Project  (2 of 2)                               │
│           ├─────────────────────────────────────────────────────┤
│           │  /Users/pierre/code/my-app  ← [change path]         │
│           │  Node.js · TypeScript · React                        │
│           │                                                      │
│           │  Project Name *                                      │
│           │  ┌─────────────────────────────────────────────┐    │
│           │  │ my-app                     (auto-filled)     │    │
│           │  └─────────────────────────────────────────────┘    │
│           │                                                      │
│           │  Description                                         │
│           │  ┌─────────────────────────────────────────────┐    │
│           │  │                                              │    │
│           │  └─────────────────────────────────────────────┘    │
│           │                                                      │
│           │  GitHub Remote  (optional)                           │
│           │  ┌─────────────────────────────────────────────┐    │
│           │  └─────────────────────────────────────────────┘    │
│           │                                                      │
│           │  ── Setup ──────────────────────────────────────    │
│           │                                                      │
│           │  [x]  Initialize git repository                      │
│           │       (this project has no .git — recommended)       │
│           │                                                      │
│           │  [x]  Generate CLAUDE.md with AI                     │
│           │       describe your project for better results       │
│           │                                                      │
│           │                      [← Back]  [Create Project]      │
└─────────────────────────────────────────────────────────────────┘
```

**Auto-filled fields**:
- Name: derived from directory name (`my-app` → `my-app`, auto title-cased)
- GitHub Remote: if `git remote -v` shows an origin, pre-fill it

**Setup section**:
- `[x] Initialize git repository`: shown and pre-checked ONLY if `is_git_repo: false`. Hidden if already a repo.
- `[x] Generate CLAUDE.md with AI`: shown and pre-checked ONLY if `has_claude_md: false`. Hidden if CLAUDE.md already exists.
- If both conditions are false (already a git repo AND already has CLAUDE.md), the Setup section is hidden entirely.

**[Create Project]** behavior:
1. Calls `POST /api/projects` (with `init_git: true` if checkbox is checked)
2. If CLAUDE.md checkbox is checked: stays on the page, transitions to the **CLAUDE.md generation step**
3. If CLAUDE.md checkbox is not checked: redirects immediately to `/projects/{id}`

---

#### Step 3 — CLAUDE.md Generation (conditional)

Only shown if "Generate CLAUDE.md" was checked. Appears inline after project creation, before navigating to the IDE.

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar  │  Generating CLAUDE.md...                             │
│           ├─────────────────────────────────────────────────────┤
│           │                                                      │
│           │  Claude is reading your project and writing          │
│           │  a CLAUDE.md tailored to your stack.                 │
│           │                                                      │
│           │  [████████████░░░░░░░]  scanning files...           │
│           │                                                      │
└─────────────────────────────────────────────────────────────────┘
```

While generating (blocking call, up to 60s):
- Show animated progress bar with rotating status messages:
  - "Scanning project files..."
  - "Reading package.json..."
  - "Writing CLAUDE.md..."
- No cancel button (the call is fast in practice)

**On success** — show preview + edit:

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar  │  Review your CLAUDE.md                               │
│           ├─────────────────────────────────────────────────────┤
│           │  Generated by Claude (claude-sonnet-4-6)             │
│           │  Used 1,840 tokens                                   │
│           │                                                      │
│           │  ┌──────────────────────────────────────────────┐   │
│           │  │ # My App                                      │   │
│           │  │                                               │   │
│           │  │ A Next.js 15 application for managing...      │   │
│           │  │                                               │   │
│           │  │ ## Tech Stack                                 │   │
│           │  │ - Next.js 15 App Router                       │   │
│           │  │ - FastAPI backend on :8000                    │   │
│           │  │ - TypeScript, Tailwind CSS 4                  │   │
│           │  │ ...                                           │   │
│           │  └──────────────────────────────────────────────┘   │
│           │  (editable textarea — user can modify before saving) │
│           │                                                      │
│           │         [Skip]    [Save CLAUDE.md and Open Project]  │
│           │                                                      │
└─────────────────────────────────────────────────────────────────┘
```

- Textarea is editable — user can refine before saving
- **[Save CLAUDE.md and Open Project]**: writes content via `PUT /api/projects/{id}/file` with `path: "CLAUDE.md"`, then navigates to `/projects/{id}`
- **[Skip]**: navigates to `/projects/{id}` without writing the file

**On generation failure** (timeout or error):

```
  Could not generate CLAUDE.md (timeout after 60s).
  You can write it manually later from the project IDE.

                                      [Open Project]
```

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `ProjectsGrid` | `components/cockpit/ProjectsGrid.tsx` | Responsive grid of project cards |
| `ProjectCard` | `components/cockpit/ProjectCard.tsx` | Name, path, run status, active indicator |
| `NewProjectWizard` | `components/project/NewProjectWizard.tsx` | Step controller for the 3-step creation flow |
| `Step1PathPicker` | `components/project/Step1PathPicker.tsx` | Path input, validation, discovery section |
| `DiskBrowser` | `components/project/DiskBrowser.tsx` | Filesystem slide-over panel |
| `DiscoverResults` | `components/project/DiscoverResults.tsx` | Scan results list with stack badges |
| `Step2Configure` | `components/project/Step2Configure.tsx` | Name, description, setup checkboxes |
| `Step3ClaudeMd` | `components/project/Step3ClaudeMd.tsx` | Generation progress + preview + edit |
| `ProjectSettings` | `components/project/ProjectSettings.tsx` | Edit name/description/remote in project IDE |

**TanStack Query hooks**:
- `useProjects()` — GET /api/projects, refetch every 10s
- `useProject(id)` — GET /api/projects/{id}
- `useValidatePath(path)` — GET /api/projects/validate-path (lazy, on blur)
- `useBrowseDirectory(path)` — GET /api/system/browse
- `useDiscoverProjects(basePath)` — GET /api/system/discover-projects (lazy, on button click)
- `useCreateProject()` — POST /api/projects
- `useGenerateClaudeMd(projectId)` — POST /api/projects/{id}/setup/generate-claude-md
- `useUpdateProject(id)` — PATCH /api/projects/{id}
- `useDeleteProject(id)` — DELETE /api/projects/{id}
- `useFileTree(projectId, worktreePath?)` — GET /api/projects/{id}/file-tree
- `useReadFile(projectId, path, worktreePath?)` — GET /api/projects/{id}/file (lazy)
- `useWriteFile(projectId)` — PUT /api/projects/{id}/file

---

## Acceptance Criteria

**Projects Browser**
- Given the app loads, When I navigate to `/projects`, Then all projects are shown as cards
- Given a project has an active run, Then a pulsing green dot and "Running" text are visible
- Given no projects, Then an empty state with a "Add your first project" CTA is shown
- Given I click a project card, Then I navigate to `/projects/{id}`

**Step 1 — Path Picker**
- Given I type a valid path and blur, Then the detected stack appears below the input
- Given I type a path that doesn't exist and blur, Then "Path not found on disk" error appears
- Given I click [Scan ~/code], Then project candidates appear in a list with their stack
- Given I click a discovered project, Then its path fills the input and validation fires
- Given I click [Browse], Then the disk browser slide-over opens
- Given I navigate in the disk browser and click [Select This Directory], Then the path input is filled

**Step 2 — Configure**
- Given the path has no .git directory, Then the "Initialize git repository" checkbox appears pre-checked
- Given the path already has .git, Then the git init checkbox is hidden
- Given the path has no CLAUDE.md, Then the "Generate CLAUDE.md" checkbox appears pre-checked
- Given the path already has CLAUDE.md, Then the CLAUDE.md checkbox is hidden
- Given both git and CLAUDE.md already exist, Then the Setup section is hidden entirely
- Given I click [Create Project] with git init checked, Then a git repo is initialized and an initial commit is created

**CLAUDE.md Generation**
- Given "Generate CLAUDE.md" is checked and I click Create, Then the generation step shows with a progress animation
- Given generation succeeds, Then a preview of the CLAUDE.md content is shown in an editable textarea
- Given I edit the content and click [Save CLAUDE.md and Open Project], Then CLAUDE.md is written via PUT /api/projects/{id}/file and I navigate to the IDE
- Given I click [Skip], Then I navigate to the IDE without writing CLAUDE.md
- Given generation times out (>60s), Then an error message is shown with an [Open Project] fallback

**File API**
- Given I call GET /api/projects/{id}/file-tree, Then the response excludes .git, node_modules, .venv, __pycache__, dist, build
- Given I call GET /api/projects/{id}/file-tree with worktree_path, Then paths are relative to the worktree root
- Given I call GET /api/projects/{id}/file with a file under 1 MB, Then the content and size are returned
- Given I call GET /api/projects/{id}/file with a file over 1 MB, Then 400 file_too_large is returned
- Given I call PUT /api/projects/{id}/file with a path that escapes the project root, Then 400 path_outside_project is returned
- Given I call PUT /api/projects/{id}/file with a valid path, Then the file is written and { ok: true } is returned

**Delete Project**
- Given I delete a project, Then it disappears from the browser
- Given I delete a project, Then its local directory is NOT touched
- Given a project has an active run when deleted, Then the run is cancelled first

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: project service (CRUD, storage) | M |
| Backend: validate-path (git detect, stack detect, CLAUDE.md check) | M |
| Backend: GET /api/system/browse (filesystem navigator) | M |
| Backend: GET /api/system/discover-projects (candidate scanner) | M |
| Backend: git init on project creation | S |
| Backend: POST generate-claude-md (stateless claude --print call) | M |
| Backend: GET /api/projects/{id}/file-tree (recursive, with exclusions) | M |
| Backend: GET /api/projects/{id}/file (read, 1 MB limit) | S |
| Backend: PUT /api/projects/{id}/file (write, path traversal guard) | S |
| Frontend: NewProjectWizard step controller | M |
| Frontend: Step1PathPicker + validation feedback | M |
| Frontend: DiskBrowser slide-over | L |
| Frontend: DiscoverResults + stack badges | M |
| Frontend: Step2Configure + setup checkboxes (conditional) | M |
| Frontend: Step3ClaudeMd (progress + preview + edit) | L |
| Frontend: ProjectsGrid + ProjectCard | M |
| Frontend: TanStack Query hooks (including file API hooks) | S |
| Frontend: delete project confirmation | S |
