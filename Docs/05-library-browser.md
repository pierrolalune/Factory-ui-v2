# Spec 05 — Library Browser

**Domain**: Library
**Route**: `/library`
**Sprint**: 4

---

## Overview

The Library is a collection of reusable Claude Code items: commands, workflows, skills, and claude-md files. Users browse the library to find items to copy into their projects, and manage their personal collection.

V2 redesigns the library from scratch. The V1 library had nested organizational layers (packages, folders, subcategories) that were confusing. V2 uses a **flat list with tags**. There are no folders or packages.

This spec covers:
- The `/library` page (browse, search, filter)
- Item detail modal
- Creating and editing user items
- Deleting items
- Copying items to a project's `.claude/` folder

Library import (scanning a `.claude/` folder to add items) is in `06-library-import.md`.

---

## Tech Stack

- **Storage**: `ClaudeLibrairy/_index.json` (flat array of item summaries) + `ClaudeLibrairy/items/{id}.json` (full item with content)
- **Frontend**: Next.js 15, TanStack Query, Tailwind CSS 4

---

## Data Model

### LibraryItem

```typescript
type LibraryItemType = "command" | "workflow" | "skill" | "claude-md"
type LibraryItemSource = "builtin" | "user" | "imported"

interface LibraryItem {
  id: string                // e.g. "li-feature-spec-a3f2b1"
  name: string              // display name, e.g. "Feature Spec"
  type: LibraryItemType
  source: LibraryItemSource
  description: string       // one-line description
  content: string           // raw markdown content of the .md file
  tags: string[]            // user-assigned free-form tags, e.g. ["planning", "architecture"]
  imported_from?: string    // original file path if source=imported
  created_at: string
  updated_at: string

  // For commands only:
  config?: CommandConfig

  // For workflows only:
  linked_command_stem?: string   // the /slash-command that triggers this workflow
  agent_deps?: string[]          // agent item IDs that this workflow requires
}

interface CommandConfig {
  command: string            // e.g. "/polisher {ARGUMENTS}" or "/lint {input_file}"
  args?: CommandArg[]        // declared args (if any)
}

interface CommandArg {
  name: string               // e.g. "input_file"
  description?: string       // shown as field label/tooltip
  required: boolean
  default_value?: string
}
```

### LibraryItemSummary (stored in `_index.json`)

```typescript
interface LibraryItemSummary {
  id: string
  name: string
  type: LibraryItemType
  source: LibraryItemSource
  description: string
  tags: string[]
  linked_command_stem?: string  // for workflows
  has_structured_args: boolean  // true if config.args is non-empty
  updated_at: string
}
```

The index is used for listing/searching. Full content is loaded only when an item is opened.

### Storage Layout

```
ClaudeLibrairy/
├── _index.json          # LibraryItemSummary[] — all items, lightweight
└── items/
    ├── li-feature-spec-a3f2b1.json    # Full LibraryItem (includes content)
    ├── li-polisher-b2c3d4.json
    └── ...
```

---

## API Endpoints

### `GET /api/library`
List all library items (summaries only, no content).

**Query params**:
| Param | Type | Description |
|---|---|---|
| `type` | string | Filter: `command`, `workflow`, `skill`, `claude-md` |
| `source` | string | Filter: `builtin`, `user`, `imported` |
| `tags` | string | Comma-separated tags to filter by (OR logic) |
| `q` | string | Full-text search on name + description |

**Response**: `LibraryItemSummary[]`

---

### `GET /api/library/{id}`
Get full item (including content).

**Response**: `LibraryItem`

---

### `POST /api/library`
Create a new user item.

**Request**:
```json
{
  "name": "My Custom Command",
  "type": "command",
  "description": "Does something useful",
  "content": "# My Custom Command\n\nDo this task: $ARGUMENTS",
  "tags": ["custom", "utility"],
  "config": {
    "command": "/my-custom-command {ARGUMENTS}",
    "args": []
  }
}
```

**Validation**:
- `name`: required, unique within library
- `type`: required, one of the enum values
- `content`: required, max 100,000 chars

**Response**: `{ "id": "li-my-custom-command-a3f2b1" }`

---

### `PATCH /api/library/{id}`
Update a user-created or imported item.

**Note**: Built-in items (`source: "builtin"`) cannot be modified. Returns `403 cannot_modify_builtin`.

**Request body**: partial LibraryItem (name, description, content, tags, config)

---

### `DELETE /api/library/{id}`
Delete an item.

**Note**: Built-in items cannot be deleted. Returns `403 cannot_delete_builtin`.

**Response**: `{ "ok": true }`

---

### `GET /api/library/tags`
Get all tags used across the library (for the filter UI).

**Response**: `string[]` — sorted alphabetically

---

### `POST /api/library/{id}/copy-to-project`
Copy a library item's `.md` file into a project's `.claude/` folder.

**Request**:
```json
{
  "project_id": "my-app-a3f2b1"
}
```

**Behavior**:
- Determines the destination subdirectory by type: `commands/`, `workflows/`, `skills/`, or root for `claude-md`
- Writes the item's `content` as `{stem}.md` into `project/.claude/{type}s/{stem}.md`
- For `workflow` items: also copies any referenced agent `.md` files listed in `agent_deps` into `project/.claude/agents/`
- Does not overwrite an existing file — returns `409` instead

**Response**:
```json
{
  "ok": true,
  "copied_to": ".claude/commands/polisher.md"
}
```

**Errors**:
- `404 project_not_found` — project_id does not exist
- `409 already_exists` — the target file already exists in the project's `.claude/` folder

---

## Page: `/library` — Library Browser

**Layout**:
```
┌──────────────────────────────────────────────────────────────────────────┐
│ Sidebar │  Library                                    [Import]  [+ New]   │
│         ├──────────────────────────────────────────────────────────────── │
│         │  Search...                                                       │
│         │                                                                  │
│         │  ALL  COMMANDS  WORKFLOWS  SKILLS  CLAUDE-MD                    │
│         │  ○ All sources  ○ Built-in  ○ Mine  ○ Imported                  │
│         │  Tags: [planning ×]  [architecture ×]  [+ Add tag filter]       │
│         ├──────────────────────────────────────────────────────────────── │
│         │                                                                  │
│         │  ┌─────────────────────┐  ┌─────────────────────┐              │
│         │  │  Feature Spec       │  │  Polisher            │              │
│         │  │  command · builtin  │  │  command · builtin   │              │
│         │  │                     │  │                      │              │
│         │  │  Turn a raw idea    │  │  Code quality and    │              │
│         │  │  into a full spec   │  │  cleanup pass        │              │
│         │  │                     │  │                      │              │
│         │  │  [planning]         │  │  [quality]           │              │
│         │  └─────────────────────┘  └─────────────────────┘              │
│         │                                                                  │
│         │  ┌─────────────────────┐  ┌─────────────────────┐              │
│         │  │  Factory Run        │  │  Code Review         │              │
│         │  │  workflow · builtin │  │  workflow · builtin  │              │
│         │  │  ...                │  │  ...                 │              │
│         │  └─────────────────────┘  └─────────────────────┘              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Filter Bar

**Type tabs**: ALL / COMMANDS / WORKFLOWS / SKILLS / CLAUDE-MD
- Clicking a tab filters the grid to that type
- Shows count badge on each tab: e.g. `COMMANDS (12)`

**Source toggle**: All sources / Built-in / Mine / Imported
- Radio button group (single selection)

**Tag filter**: Multi-select tags
- Shows currently active tags as dismissible pills
- "+ Add tag filter" opens a dropdown of all available tags
- Tags use OR logic: item matching ANY selected tag is shown

**Search**: Full-text search, filters on name + description as you type.

### Item Grid

- Responsive: 2–3 columns on desktop, 1 on mobile
- Each card shows: name, type badge, source badge, description, tags

**Item Card**:
```
┌─────────────────────────────────────┐
│  Feature Spec                        │
│  COMMAND  ·  BUILTIN                 │
│                                      │
│  Turn a raw idea into a complete     │
│  feature specification with user     │
│  stories, AC, UX flow...             │
│                                      │
│  [planning]  [architecture]          │
└─────────────────────────────────────┘
```

- Click → opens Item Detail modal
- Type badge color:
  - command: sapphire (`#4195e8`)
  - workflow: purple-ish neutral
  - skill: muted teal
  - claude-md: muted amber
- Source badge: "BUILTIN" (muted), "MINE" (green outline), "IMPORTED" (grey outline)

### Empty / Loading States

| State | Display |
|---|---|
| Loading | 6 skeleton cards |
| No items | "Your library is empty. Import from a .claude/ folder or create a new item." |
| No search results | "No items match '{query}'." + Clear search link |
| Filtered to empty | "No items match your filters." + Clear filters link |

---

## Item Detail Modal

Opens when clicking a card. Full-screen on mobile, centered modal on desktop.

```
┌─────────────────────────────────────────────────────────────┐
│  Feature Spec                                        [× Close]│
│  COMMAND  ·  BUILTIN                                         │
│  Turn a raw idea into a complete feature specification        │
│                                                              │
│  Tags: [planning]  [architecture]  [+ edit tags]             │
│                                                              │
│  ─── Content ─────────────────────────────────────────────   │
│  # Feature Spec                                              │
│                                                              │
│  Turn a raw idea into a spec with user story, AC, UX flow... │
│  [rendered markdown]                                         │
│                                                              │
│  ─── Config ───────────────────────────────────────────────  │
│  Command: /feature-spec {ARGUMENTS}                          │
│                                                              │
│  ─── Actions ──────────────────────────────────────────────  │
│  [Edit]  [Delete]                     [Copy to Project ▾]    │
└─────────────────────────────────────────────────────────────┘
```

**Actions**:
- **Edit** (user/imported items only): opens inline editor (textarea with raw markdown + metadata fields)
- **Delete** (user/imported items only): confirmation dialog
- **Copy to Project** dropdown:
  - Shows a list of registered projects
  - Selecting a project calls `POST /api/library/{id}/copy-to-project`
  - On success: shows a brief confirmation "Copied to .claude/commands/polisher.md"
  - On `409 already_exists`: shows inline error "This item already exists in that project's .claude/ folder"
  - After copying, the user launches the item from the project IDE

There is no "Use in Run" action. The user must copy the item to a project first, then launch it from the project IDE's launch panel.

---

## Create / Edit Item

Accessible via the `[+ New]` button in the header, or Edit in item detail.

**Form**:
```
  Name *
  ┌──────────────────────────────────────────────────────────┐
  │ My Custom Command                                         │
  └──────────────────────────────────────────────────────────┘

  Type *   ○ Command  ○ Workflow  ○ Skill  ○ Claude-MD

  Description *
  ┌──────────────────────────────────────────────────────────┐
  │ Does something useful for X scenario                      │
  └──────────────────────────────────────────────────────────┘

  Tags
  ┌──────────────────────────────────────────────────────────┐
  │ [planning ×]  [custom ×]  Type and press Enter...         │
  └──────────────────────────────────────────────────────────┘

  Content (Markdown) *
  ┌──────────────────────────────────────────────────────────┐
  │ # My Custom Command                                       │
  │                                                           │
  │ $ARGUMENTS                                                │
  └──────────────────────────────────────────────────────────┘
  (raw markdown editor, monospace font)

  ── Command Config (only if type = Command) ──

  Command template *
  ┌──────────────────────────────────────────────────────────┐
  │ /my-custom-command {ARGUMENTS}                            │
  └──────────────────────────────────────────────────────────┘

                                    [Cancel]  [Save Item]
```

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `LibraryPage` | `app/(app)/library/page.tsx` | Root page |
| `LibraryGrid` | `components/library/LibraryGrid.tsx` | Responsive grid of item cards |
| `LibraryItemCard` | `components/library/LibraryItemCard.tsx` | Card: name, type, source, description, tags |
| `LibraryFilters` | `components/library/LibraryFilters.tsx` | Type tabs, source radio, tag multi-select, search |
| `LibraryItemModal` | `components/library/LibraryItemModal.tsx` | Detail modal: content, config, actions |
| `LibraryItemForm` | `components/library/LibraryItemForm.tsx` | Create/edit form |
| `CopyToProjectDropdown` | `components/library/CopyToProjectDropdown.tsx` | Project picker dropdown + copy-to-project call |
| `TagPill` | `components/library/TagPill.tsx` | Dismissible tag pill |
| `TypeBadge` | `components/library/TypeBadge.tsx` | Colored type indicator |

**TanStack Query hooks**:
- `useLibraryItems(filters)` — GET /api/library with filters
- `useLibraryItem(id)` — GET /api/library/{id}
- `useCreateLibraryItem()` — POST /api/library
- `useUpdateLibraryItem(id)` — PATCH /api/library/{id}
- `useDeleteLibraryItem(id)` — DELETE /api/library/{id}
- `useLibraryTags()` — GET /api/library/tags
- `useCopyToProject(id)` — POST /api/library/{id}/copy-to-project

---

## Acceptance Criteria

**Browsing**
- Given the library page loads, Then all items are shown as cards in a grid
- Given I click "COMMANDS" tab, Then only command items are shown and a count badge is visible
- Given I select tag "planning", Then only items tagged "planning" are shown
- Given I type in the search box, Then the grid filters in real time by name and description
- Given I combine type tab + tag filter + search, Then all three filters apply together

**Item Detail**
- Given I click an item card, Then a modal opens with the item's name, description, content (rendered markdown), and config
- Given the item is builtin, Then Edit and Delete buttons are not shown
- Given the item is user-created, Then Edit and Delete buttons are shown
- Given I click "Copy to Project" and pick a project, Then the item's .md file is written to that project's .claude/ folder
- Given the item already exists in the target project, Then an error "already exists in that project's .claude/ folder" is shown
- Given there is no "Use in Run" button, Then the user is guided to copy the item and launch from the IDE

**Create / Edit**
- Given I create a new item with name, type, description, and content, Then it appears in the library grid with source "MINE"
- Given I edit a user item, Then the changes are reflected immediately in the grid and modal
- Given I try to create an item with a duplicate name, Then I see an inline error

**Delete**
- Given I delete a user item and confirm, Then it disappears from the grid
- Given I try to delete a builtin item, Then the delete button is absent (not just disabled)

**Copy to Project**
- Given I copy a workflow item, Then its referenced agent .md files are also copied to .claude/agents/
- Given the copy succeeds, Then a confirmation message shows the destination path

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: library service (read/write flat JSON) | M |
| Backend: GET /api/library with filters | M |
| Backend: POST/PATCH/DELETE /api/library | M |
| Backend: GET /api/library/tags | S |
| Backend: POST /api/library/{id}/copy-to-project | M |
| Frontend: LibraryGrid + LibraryItemCard | M |
| Frontend: LibraryFilters (type tabs, source, tags, search) | M |
| Frontend: LibraryItemModal (detail view + Copy to Project dropdown) | M |
| Frontend: LibraryItemForm (create/edit) | M |
| Frontend: TanStack hooks + Zustand filter state | S |
