# Spec 12 — Code Review

**Domain**: Code Review
**Route**: `/projects/[id]/review`
**Sprint**: 8

---

## Overview

Code Review provides a visual dependency graph of the project's codebase. The user can explore module dependencies, understand the blast radius of changes, and review what files are affected by recent git modifications.

V2 uses `@xyflow/react` (ReactFlow) + dagre for layout, rendered natively in React. V1 used D3 in an iframe with postMessage — that approach is replaced entirely.

The graph is built by the `code-review-graph` Python library, which creates a SQLite database of nodes (functions, classes, modules) and edges (imports, calls, extends).

---

## Tech Stack

- **Backend**: `code-review-graph` Python library, SQLite DB at `{project_path}/.code-review-graph/graph.db`
- **Frontend**: `@xyflow/react` v12 (ReactFlow), `dagre` for automatic layout, Next.js 15
- **Route**: `/projects/[id]/review` (full-screen page, navigated from the Review tab in the project IDE)

---

## Data Model

### GraphNode

```typescript
interface GraphNode {
  id: string                    // qualified name, e.g. "src/auth.ts::createSession"
  name: string                  // short name, e.g. "createSession"
  kind: "function" | "class" | "type" | "module" | "variable" | "export"
  file_path: string             // relative path, e.g. "src/auth.ts"
  line_number?: number
}
```

### GraphEdge

```typescript
interface GraphEdge {
  source: string                // source node id
  target: string                // target node id
  type: "import" | "call" | "extends" | "implements"
}
```

### GraphData

```typescript
interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
```

### GraphStats

```typescript
interface GraphStats {
  built: boolean
  node_count: number
  edge_count: number
  file_count: number
  last_built_at?: string        // ISO 8601
}
```

### ImpactResult

```typescript
interface ImpactResult {
  changed_files: string[]       // input files
  affected_nodes: GraphNode[]   // nodes that depend on changed files (transitively)
  affected_files: string[]      // unique file paths containing affected nodes
  depth: number                 // how many hops were traversed
}
```

---

## API Endpoints

### `GET /api/projects/{id}/code-review/stats`

Get graph build status and statistics.

**Response**: `GraphStats`

```json
{
  "built": true,
  "node_count": 342,
  "edge_count": 891,
  "file_count": 47,
  "last_built_at": "2026-03-28T10:00:00Z"
}
```

If graph has never been built: `{ "built": false, "node_count": 0, "edge_count": 0, "file_count": 0 }`

---

### `POST /api/projects/{id}/code-review/build`

Build or rebuild the dependency graph. Synchronous call — can take 5-30 seconds for large projects.

**Request**:
```json
{
  "full_rebuild": false
}
```

- `full_rebuild: false` (default): incremental update (only changed files since last build)
- `full_rebuild: true`: delete and rebuild from scratch

**Response**: `GraphStats` (after build completes)

**Errors**:
- `400 not_a_git_repo` — project directory is not a git repository

---

### `POST /api/projects/{id}/code-review/graph-data`

Get graph nodes and edges, optionally filtered by mode.

**Request**:
```json
{
  "mode": "full",
  "targets": [],
  "depth": 2,
  "kind_filter": null
}
```

| Param | Type | Description |
|---|---|---|
| `mode` | `"full" \| "focus" \| "modified"` | Graph query mode |
| `targets` | `string[]` | Node IDs to focus on (for `focus` mode) |
| `depth` | `int` (1-3) | BFS hop depth (for `focus` and `modified` modes) |
| `kind_filter` | `string[] \| null` | Filter nodes by kind (e.g. `["function", "class"]`) |

**Mode behavior**:
- `full`: return all nodes and edges. If node_count > 500, the response includes `"warning": "Large graph — consider using focus mode"`
- `focus`: BFS from `targets`, return nodes within `depth` hops and all connecting edges
- `modified`: seed from git-modified files (compared to HEAD), expand `depth` hops

**Response**: `GraphData`

**Errors**:
- `400 graph_not_built` — graph has not been built yet
- `400 no_targets` — `focus` mode requires at least one target

---

### `POST /api/projects/{id}/code-review/impact`

Compute blast radius for changed files. Returns all nodes that transitively depend on the changed files.

**Request**:
```json
{
  "changed_files": ["src/auth.ts", "src/session.ts"],
  "max_depth": 3
}
```

**Response**: `ImpactResult`

```json
{
  "changed_files": ["src/auth.ts", "src/session.ts"],
  "affected_nodes": [
    { "id": "src/middleware.ts::authMiddleware", "name": "authMiddleware", "kind": "function", "file_path": "src/middleware.ts" }
  ],
  "affected_files": ["src/middleware.ts", "src/api/login.ts", "src/api/logout.ts", "tests/auth.test.ts"],
  "depth": 3
}
```

---

### `GET /api/projects/{id}/code-review/nodes`

Lightweight node list for autocomplete and search. No edges, no detailed data.

**Response**: `Array<{ id: string, name: string, kind: string, file_path: string }>`

Used by the search input in the controls bar to suggest focus targets.

---

## Page Layout

Full-screen page at `/projects/[id]/review`. Not a panel — navigated via the Review tab in the project IDE's right panel, which shows a CTA:

```
  Code Review

  Understand your project's dependency structure
  and the blast radius of any file change.

  [Open Dependency Graph ->]
```

Clicking the CTA navigates to `/projects/[id]/review`.

### Full-Screen Layout

```
+----------------------------------------------------------------------+
|  [<- Back to Project]    Code Review -- My App      [Rebuild Graph]   |
+----------------------------------------------------------------------+
|  Mode: (Full) (Focus) (Modified)    Search: [__________]             |
|  Kind: [All v]    Depth: [2 v]                                       |
+---------------------------------------------------+------------------+
|                                                   |  Node Detail     |
|                                                   |                  |
|         ReactFlow Graph                           |  createSession   |
|         (dagre-laid-out nodes + edges)            |  function        |
|                                                   |  src/auth.ts:42  |
|    [auth.ts]--->[session.ts]--->[db.ts]           |                  |
|        |                                          |  Imports:        |
|        v                                          |  - SessionService|
|    [middleware.ts]                                 |  - DatabaseClient|
|                                                   |                  |
|                                                   |  Imported by:    |
|                                                   |  - middleware.ts |
|                                                   |  - api/login.ts  |
|                                                   |                  |
|                                                   |  Blast Radius:   |
|                                                   |  4 files affected|
|                                                   |  - middleware.ts |
|                                                   |  - api/login.ts  |
|                                                   |  - api/logout.ts |
|                                                   |  - auth.test.ts  |
+---------------------------------------------------+------------------+
```

---

## Controls Bar

| Control | Type | Values | Description |
|---|---|---|---|
| Mode | Radio buttons | Full / Focus / Modified | Determines which graph data is loaded |
| Search | Text input | Free text | Filters/highlights nodes by name or file path. In Focus mode, also used to select focus targets |
| Kind | Dropdown | All / function / class / type / module / variable / export | Filter nodes by kind |
| Depth | Dropdown | 1 / 2 / 3 | BFS depth for Focus and Modified modes. Hidden in Full mode |
| [Rebuild Graph] | Button | — | Triggers `POST /api/projects/{id}/code-review/build` |

**Mode behavior**:
- **Full**: loads all nodes. Kind filter and search apply client-side. Depth hidden.
- **Focus**: user searches for a node, selects it as a target. Graph shows that node + neighbors up to `depth` hops.
- **Modified**: automatically seeds from git-modified files. Graph shows modified nodes + neighbors up to `depth` hops. Modified nodes have an amber outline.

---

## Graph Area (ReactFlow)

### Node Rendering

Each node is a custom ReactFlow node component showing:
- Node name (truncated if >30 chars)
- Kind badge (small, below name)
- File path (micro text, muted)

### Node Colors (by kind)

| Kind | Color | Hex |
|---|---|---|
| function | Sapphire | `#4195e8` |
| class | Purple | `#8b5cf6` |
| type | Teal | `#14b8a6` |
| module | Grey | `#6b7280` |
| variable | Amber | `#f59e0b` |
| export | Green | `#22c55e` |

### Node States

- Default: filled with kind color at 20% opacity, border in kind color
- Selected: solid kind-color border (2px), brighter background
- Modified (in Modified mode): amber outline ring
- Highlighted (search match): pulsing glow effect

### Edge Rendering

- Directed arrows (source -> target)
- Color: `#263245` (border color, subtle)
- Selected node's edges: highlighted in `#4195e8`
- Edge type label not shown by default (too noisy)

### Layout

- dagre algorithm, direction: top-to-bottom (`TB`)
- Node spacing: 60px vertical, 40px horizontal
- Re-layout on mode change or data change
- User can pan (drag) and zoom (scroll wheel)

### Interactions

- Click node: select it, show in Node Detail panel, highlight its edges
- Click background: deselect
- Drag: pan the graph
- Scroll: zoom in/out
- Minimap: bottom-left corner (ReactFlow built-in)

---

## Node Detail Panel (Right, 320px)

Shown when a node is selected. Hidden when nothing is selected.

### Content

- **Name**: node name (large)
- **Kind**: badge
- **File**: file path + line number (clickable — navigates to file in project IDE editor)
- **Imports** (dependencies): list of nodes this node depends on. Each clickable (focuses graph on that node).
- **Imported by** (dependents): list of nodes that depend on this node. Each clickable.
- **Blast Radius**: "If this file changes, N files are affected" with list of affected file paths. Computed via `POST /api/projects/{id}/code-review/impact` with the node's file.

---

## Graph Not Built State

Shown when `GET /api/projects/{id}/code-review/stats` returns `{ "built": false }`.

```
  This project's dependency graph has not been built yet.

  Building the graph analyzes your codebase's imports and
  dependencies to create a navigable map. This usually
  takes 5-30 seconds depending on project size.

  [Build Graph]
```

---

## Building State

Shown while `POST /api/projects/{id}/code-review/build` is in progress.

```
  Building dependency graph...
  This may take up to 30 seconds for large projects.

  [spinner]
```

Build button disabled during this state.

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `CodeReviewPage` | `app/(app)/projects/[id]/review/page.tsx` | Full-screen page layout |
| `GraphControls` | `components/code-review/GraphControls.tsx` | Mode selector, search, kind filter, depth |
| `DependencyGraph` | `components/code-review/DependencyGraph.tsx` | ReactFlow canvas + dagre layout |
| `GraphNode` | `components/code-review/GraphNode.tsx` | Custom ReactFlow node component |
| `NodeDetailPanel` | `components/code-review/NodeDetailPanel.tsx` | Right panel: imports, dependents, blast radius |
| `BuildGraphCTA` | `components/code-review/BuildGraphCTA.tsx` | "Build Graph" button + not-built state |

**TanStack Query hooks**:
- `useGraphStats(projectId)` — GET /api/projects/{id}/code-review/stats
- `useBuildGraph(projectId)` — POST build (mutation)
- `useGraphData(projectId, params)` — POST graph-data
- `useImpactAnalysis(projectId, changedFiles)` — POST impact
- `useGraphNodes(projectId)` — GET nodes (for search autocomplete)

---

## Acceptance Criteria

**Graph Building**
- Given the graph has never been built, Then a "Build Graph" CTA is shown instead of the graph
- Given I click Build Graph, Then a spinner appears and the graph builds
- Given the build completes, Then nodes and edges are displayed in the ReactFlow canvas
- Given I click Rebuild Graph, Then the graph is rebuilt from scratch

**Full Mode**
- Given I select Full mode, Then all nodes and edges are displayed
- Given the project has >500 nodes, Then a warning is shown: "Large graph -- consider using Focus mode"
- Given I type in the search box, Then nodes matching the text are highlighted

**Focus Mode**
- Given I select Focus mode and search for "createSession", Then only that node and its neighbors (up to depth) are shown
- Given I change depth from 2 to 3, Then the graph expands to show 3 hops from the focus node
- Given I click a node in the detail panel's Imports list, Then the graph refocuses on that node

**Modified Mode**
- Given I select Modified mode, Then nodes from git-modified files are shown with amber outlines and their dependencies are included
- Given no files are modified, Then "No modified files detected" is shown

**Node Detail**
- Given I click a node, Then the detail panel shows its name, kind, file, imports, dependents, and blast radius
- Given I click a file path in the detail panel, Then I navigate to that file in the project editor
- Given the blast radius is computed, Then I see a list of affected files

**Kind Filter**
- Given I filter by kind "class", Then only class nodes are shown in the graph
- Given I filter by kind "All", Then all node kinds are shown

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: code_review_service wrapper (build, query, impact, nodes) | M |
| Backend: GET stats, POST build endpoints | S |
| Backend: POST graph-data (full/focus/modified modes) | M |
| Backend: POST impact (blast radius) | M |
| Backend: GET nodes (autocomplete list) | S |
| Frontend: CodeReviewPage layout (controls + graph + detail) | M |
| Frontend: DependencyGraph (ReactFlow + dagre layout + custom nodes) | XL |
| Frontend: GraphNode custom component (colors, states, interactions) | M |
| Frontend: NodeDetailPanel (imports, dependents, blast radius) | M |
| Frontend: GraphControls (mode selector, search, kind, depth) | M |
| Frontend: BuildGraphCTA + building state | S |
