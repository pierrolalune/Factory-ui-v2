# Spec 06 — Library Import

**Domain**: Library
**Route**: Modal / wizard (no dedicated page)
**Sprint**: 4

---

## Overview

Library Import lets the user scan an existing `.claude/` folder (from any project or Claude Code installation) and import selected items into the Factory UI library. This is the primary way to populate the library with real-world commands, agents, skills, and workflows that the user already uses.

This feature consists of:
1. A backend scanner that reads `.claude/` directory structure
2. An import wizard (modal/drawer) in the frontend

---

## Tech Stack

- **Backend**: Python file scanning, markdown parsing
- **Frontend**: Multi-step wizard modal, Next.js 15

---

## Directory Structure Scanned

The scanner expects a `.claude/` directory with this layout (standard Claude Code layout):

```
.claude/
├── commands/        → type: "command"
│   ├── feature-spec.md
│   ├── polisher.md
│   └── ...
├── agents/          → type: "agent" (stored in library but not directly launchable)
│   ├── architect.md
│   └── ...
├── skills/          → type: "skill"
│   ├── api-design.md
│   └── ...
├── workflows/       → type: "workflow"  (if custom workflows dir exists)
│   └── ...
└── CLAUDE.md        → type: "claude-md" (the project CLAUDE.md)
```

Note: `agents/` items are imported into the library as type `agent` for reference and workflow dependency resolution, but they are NOT shown in the Browse Library launch picker (they are internal workflow tools).

---

## Data Model

### ScannedItem (preview before import)

```typescript
interface ScannedItem {
  name: string              // filename without extension, e.g. "feature-spec"
  type: "command" | "agent" | "skill" | "workflow" | "claude-md"
  source_path: string       // absolute path to the file
  description: string       // extracted from first non-heading line of markdown
  content_preview: string   // first 200 chars of content
  already_in_library: boolean  // true if an item with same name+type already exists
  existing_id?: string      // id of the existing item if already_in_library
}
```

### ImportResult

```typescript
interface ImportResult {
  imported: number
  skipped: number          // already existed + user chose not to overwrite
  overwritten: number      // existed and user chose to overwrite
  errors: Array<{ file: string, reason: string }>
}
```

---

## API Endpoints

### `POST /api/library/scan`
Scan a directory for importable items.

**Request**:
```json
{
  "path": "/Users/pierre/code/my-app"
}
```

The scanner automatically looks for `.claude/` inside `path`. If `path` itself ends with `.claude/`, it scans that directly.

**Validation**:
- `path` must exist on disk
- Must contain a `.claude/` subdirectory OR be a `.claude/` directory

**Response**:
```json
{
  "scan_root": "/Users/pierre/code/my-app/.claude",
  "items": [ ScannedItem ]
}
```

**Errors**:
- `400 path_not_found` — path does not exist
- `400 no_claude_dir` — no `.claude/` directory found at this path

---

### `POST /api/library/import`
Import selected items from a previous scan.

**Request**:
```json
{
  "scan_root": "/Users/pierre/code/my-app/.claude",
  "items": [
    {
      "source_path": "/Users/pierre/code/my-app/.claude/commands/feature-spec.md",
      "overwrite": false
    },
    {
      "source_path": "/Users/pierre/code/my-app/.claude/commands/polisher.md",
      "overwrite": true
    }
  ]
}
```

**Behavior**:
- For each selected item, reads the file, parses it, creates/updates a `LibraryItem`
- Sets `source: "imported"`, `imported_from: source_path`
- If `overwrite: false` and item already exists → skip it
- If `overwrite: true` and item already exists → update content + metadata

**Response**: `ImportResult`

---

## Frontend: Import Wizard

Triggered from:
- **Library page header**: `[Import]` button
- **Library empty state**: "Import from a .claude/ folder" link

The wizard is a multi-step modal/drawer.

---

### Step 1 — Pick Directory

```
┌────────────────────────────────────────────────────────────┐
│  Import from .claude/                             [× Close] │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Enter the path to a project containing a .claude/ folder: │
│                                                             │
│  ┌───────────────────────────────────────────────────┐     │
│  │ /Users/pierre/code/my-app                         │     │
│  └───────────────────────────────────────────────────┘     │
│  ⚠ No .claude/ directory found at this path  (inline err)  │
│                                                             │
│  ── Or pick a project ──────────────────────────────────── │
│                                                             │
│  My App          /Users/pierre/code/my-app                 │
│  Factory UI      /Users/pierre/Desktop/Factory/UI-Factory  │
│  Blog            /Users/pierre/code/blog                   │
│                                                             │
│                                    [Cancel]  [Scan →]       │
└────────────────────────────────────────────────────────────┘
```

- Text input for manual path entry
- Quick-pick list of registered Factory UI projects (clicking fills the path)
- [Scan] button calls `POST /api/library/scan`
- Inline error if path not found or no `.claude/` dir

---

### Step 2 — Preview & Select

```
┌────────────────────────────────────────────────────────────┐
│  Import from .claude/                             [× Close] │
│  /Users/pierre/code/my-app/.claude                         │
├────────────────────────────────────────────────────────────┤
│  Found 14 items                      [Select All]           │
│                                                             │
│  COMMANDS (8)                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ☑  feature-spec     command   Turn a raw idea into.. │  │
│  │ ☑  polisher         command   Code quality pass...   │  │
│  │ ☑  retro            command   Weekly retrospective.. │  │
│  │ ☐  factory          command   ⚠ Already in library   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  SKILLS (4)                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ☑  api-design       skill     REST API design...     │  │
│  │ ☑  frontend-design  skill     UI component design... │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  AGENTS (2)  ⓘ Agents are imported for reference only      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ☑  architect        agent     System architecture... │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ── Already in library ─────────────────────────────────── │
│  □ factory (command) is already in your library.           │
│    [Overwrite with this version]                            │
│                                                             │
│                              [← Back]  [Import Selected →]  │
└────────────────────────────────────────────────────────────┘
```

**Behavior**:
- Items grouped by type
- All new items pre-checked by default
- Items already in library: unchecked by default, amber warning badge, optional "Overwrite" toggle
- [Select All] checks all items (including already-in-library ones)
- Agent items show a tooltip: "Agents are imported for reference and workflow dependency resolution — they are not directly launchable"
- [Import Selected] disabled if no items checked

---

### Step 3 — Done

```
┌────────────────────────────────────────────────────────────┐
│  Import Complete                                  [× Close] │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ✓  11 items imported                                       │
│  ⊘  1 item skipped  (already in library)                   │
│  ✗  0 errors                                               │
│                                                             │
│  ── Imported ───────────────────────────────────────────── │
│  feature-spec    command                                    │
│  polisher        command                                    │
│  retro           command                                    │
│  api-design      skill                                      │
│  ...                                                        │
│                                                             │
│                              [View Library]  [Import More]  │
└────────────────────────────────────────────────────────────┘
```

- [View Library] closes the modal and the library grid refreshes
- [Import More] returns to Step 1 for another scan

---

## Parsing Rules

The backend extracts metadata from markdown files using these rules:

**Name**: filename without extension, e.g. `feature-spec.md` → `feature-spec`

**Display Name**: title-cased and hyphen-replaced, e.g. `feature-spec` → `Feature Spec`

**Description**: extracted as the first non-heading, non-empty line of content.
```markdown
# Feature Spec          ← skip (heading)
                        ← skip (empty)
Turn a raw idea...      ← use this as description
```

**Command stem** (for commands): the filename stem becomes the slash command: `feature-spec` → `/feature-spec`

**Agent deps** (for workflows): scan the workflow content for agent references like `@architect` or `Use the architect agent` — extract agent names and link to library items.

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `ImportWizard` | `components/library/ImportWizard.tsx` | Multi-step modal orchestrator |
| `ImportStep1` | `components/library/ImportStep1.tsx` | Path input + project quick-pick |
| `ImportStep2` | `components/library/ImportStep2.tsx` | Grouped item list with checkboxes |
| `ImportStep3` | `components/library/ImportStep3.tsx` | Results summary |
| `ImportItemRow` | `components/library/ImportItemRow.tsx` | Single item row: checkbox, name, type, description, already-in-library warning |

**TanStack Query hooks**:
- `useScanDirectory()` — POST /api/library/scan
- `useImportItems()` — POST /api/library/import

---

## Acceptance Criteria

**Step 1**
- Given I click [Import] on the library page, Then the wizard opens at step 1
- Given I enter a path that contains a `.claude/` folder, Then clicking Scan proceeds to step 2
- Given I enter a path with no `.claude/` folder, Then an inline error "No .claude/ directory found" appears
- Given I click a registered project from the quick-pick list, Then its path is filled in the input

**Step 2**
- Given the scan finds items, Then they are grouped by type with all new items pre-checked
- Given an item already exists in the library, Then it is unchecked by default with an amber warning
- Given I check "Overwrite with this version" for an existing item, Then it will be overwritten on import
- Given no items are checked, Then the [Import Selected] button is disabled

**Step 3**
- Given I click [Import Selected], Then the import runs and I see a summary (imported / skipped / errors)
- Given I click [View Library], Then the wizard closes and the library grid shows the new items

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: directory scanner (traverse .claude/, parse markdown) | M |
| Backend: POST /api/library/scan | S |
| Backend: POST /api/library/import (batch create/update) | M |
| Frontend: ImportWizard multi-step shell | M |
| Frontend: Step 1 (path input, project quick-pick) | S |
| Frontend: Step 2 (grouped checkboxes, overwrite handling) | M |
| Frontend: Step 3 (results summary) | S |
