# Spec 13 — App Shell & Navigation

**Domain**: Shell
**Route**: All pages (wrapper)
**Sprint**: 1

---

## Overview

The App Shell wraps every page in Factory UI. It provides the sidebar navigation, mobile bottom nav, breadcrumbs, global search (Cmd+K), keyboard shortcuts, and the toast notification system.

This is the first thing built in Sprint 1 — all other pages render inside it.

---

## Tech Stack

- **Frontend**: Next.js 15 App Router layout, Zustand, TanStack Query
- **Icons**: Lucide React

---

## Layout

### Desktop (>= 768px)

```
+--+------------------------------------+
|  |                                    |
|S |         Main Content Area          |
|i |                                    |
|d |    (page content renders here)     |
|e |                                    |
|b |                                    |
|a |                                    |
|r |                                    |
|  |                                    |
+--+------------------------------------+
```

Sidebar: 240px expanded, 64px collapsed. Main content: flex-1.

### Mobile (< 640px)

```
+--------------------------------------+
| Top Bar (project name + hamburger)   |
+--------------------------------------+
|                                      |
|          Main Content Area           |
|                                      |
+--------------------------------------+
| [Cockpit] [Projects] [Runs] [Library]|
+--------------------------------------+
```

No sidebar. Top bar + bottom navigation.

---

## Sidebar

### Expanded (240px)

```
+--------------------------------------+
|  FACTORY                      [<<]   |
+--------------------------------------+
|                                      |
|  > Cockpit         LayoutDashboard   |
|    Projects         FolderKanban     |
|    Runs             Terminal         |
|    Library          Library          |
|                                      |
|  ----------------------------------- |
|    Settings          Settings        |
|                                      |
|  ----------------------------------- |
|  -- Active Runs --                   |
|                                      |
|  My App                              |
|    /polisher  0:42  $0.06            |
|    > Writing: auth.ts               |
|                                      |
|    /retro  1:12                      |
|    ! Waiting for input               |
|                                      |
+--------------------------------------+
```

**Nav items** (5 + 1 separator):
- Cockpit (`/`) — LayoutDashboard icon
- Projects (`/projects`) — FolderKanban icon
- Runs (`/runs`) — Terminal icon, badge with active run count
- Library (`/library`) — Library icon
- (divider)
- Settings (`/settings`) — Settings icon

**Active indicator**: left border `#4195e8` + `bg-[#1f2a3e]` on current route.

**Collapse toggle** (`[<<]`): shrinks sidebar to 64px, shows icon-only nav with tooltips on hover.

### Collapsed (64px)

- Icon-only navigation
- Tooltip on hover showing the label
- No active runs widget (too narrow)
- Expand toggle at bottom

### Active Runs Widget

Shown at the bottom of the expanded sidebar when any runs are active.

- Grouped by project name
- Each run: command stem, elapsed time (live counter), cost
- Phase line: current tool use (e.g. "Writing: auth.ts")
- `awaiting_input` runs: shown with amber text "Waiting for input", sorted to top
- Click a run: navigate to `/projects/{project_id}` and focus that run's terminal
- Data source: `GET /api/runs?status=active` polled every 2s

---

## Mobile Bottom Navigation

Visible on screens < 640px. Fixed to bottom of viewport.

```
  [Cockpit]  [Projects]  [Runs]  [Library]
```

- 4 items, icon + label below
- Active item: sapphire color (`#4195e8`), inactive: muted (`#8299b8`)
- Runs tab: badge with active run count (lime dot if any active)
- Height: 56px
- Background: `#192030`, border-top: `#263245`

---

## Top Bar (Desktop)

```
  Cockpit > Projects > My App              [Cmd+K]  [?]
```

- **Breadcrumb**: page hierarchy, clickable segments
- **[Cmd+K]**: search shortcut hint (clicking opens search modal)
- **[?]**: keyboard shortcuts hint (clicking opens overlay)

On mobile (< 640px): top bar shows current page name + hamburger menu button.

---

## Global Search Modal (Cmd+K)

Full-screen overlay on mobile, centered modal on desktop (max-width 640px).

```
+--------------------------------------+
|  Search...                    [x]    |
+--------------------------------------+
|                                      |
|  PROJECTS                            |
|  > My App        ~/code/my-app       |
|    Factory UI    ~/Desktop/Factory    |
|                                      |
|  RUNS                                |
|  > /polisher     My App  32s  $0.04  |
|                                      |
|  LIBRARY                             |
|  > Feature Spec  command  planning   |
|                                      |
+--------------------------------------+
```

- Search across: projects (by name), runs (by session name or command), library items (by name or description)
- Results grouped by category
- Keyboard: arrow keys navigate, Enter selects, Esc closes
- Navigate to the selected item's page on Enter
- Debounced search (200ms)
- Empty state: "Type to search projects, runs, and library items"

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Cmd+K` / `Ctrl+K` | Open global search |
| `Shift+?` | Show keyboard shortcuts overlay |
| `G then H` | Navigate to Cockpit (home) |
| `G then P` | Navigate to Projects |
| `G then R` | Navigate to Runs |
| `G then L` | Navigate to Library |
| `G then S` | Navigate to Settings |

The shortcuts overlay is a modal listing all available shortcuts, grouped by category.

---

## Toast Notification System

Renders in the bottom-right corner of the viewport, above all other content.

### Toast Types

| Type | Icon | Border | Auto-dismiss |
|---|---|---|---|
| `success` | Check circle | `#22c55e` | 4 seconds |
| `error` | X circle | `#f25c5c` | 4 seconds |
| `info` | Info circle | `#3b82f6` | 4 seconds |
| `action` | Bell | `#f59e0b` | Never (manual) |

### Behavior

- Max 5 toasts visible at once
- Newest toast appears on top
- Each toast: icon + message text + optional link + close button
- Auto-dismiss: 4-second timer with a subtle progress bar (except `action` toasts)
- `action` toasts: used for `awaiting_input` runs — show "Run needs input" + link to the run. Deduplicated by `runId`. Dismissed when the run resumes (via WebSocket `awaiting_input_update` with `false`).
- Toast width: 360px

---

## Zustand Store: Shell State

```typescript
interface ShellStore {
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  mobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void

  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
}
```

Persisted to localStorage: `sidebarCollapsed`.

## Zustand Store: Toast State

```typescript
interface Toast {
  id: string
  type: "success" | "error" | "info" | "action"
  message: string
  href?: string       // optional link
  runId?: string      // for action toasts — dedup key
}

interface ToastStore {
  toasts: Toast[]
  addToast: (type: Toast["type"], message: string, href?: string) => void
  addActionToast: (runId: string, message: string, href: string) => void
  removeToast: (id: string) => void
  dismissByRunId: (runId: string) => void
}
```

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `AppShell` | `components/shell/AppShell.tsx` | Root wrapper: sidebar + main area + toast region |
| `Sidebar` | `components/shell/Sidebar.tsx` | Collapsible nav + active runs widget |
| `BottomNav` | `components/shell/BottomNav.tsx` | Mobile bottom navigation (4 items) |
| `TopBar` | `components/shell/TopBar.tsx` | Breadcrumb + search hint + shortcuts hint |
| `Breadcrumb` | `components/shell/Breadcrumb.tsx` | Page hierarchy path |
| `GlobalSearchModal` | `components/shell/GlobalSearchModal.tsx` | Cmd+K search overlay |
| `KeyboardShortcutsOverlay` | `components/shell/KeyboardShortcutsOverlay.tsx` | Shift+? shortcut list |
| `ToastRegion` | `components/shell/ToastRegion.tsx` | Toast container + individual toast items |
| `ActiveRunsWidget` | `components/shell/ActiveRunsWidget.tsx` | Sidebar live runs grouped by project |

---

## Acceptance Criteria

**Sidebar**
- Given any page on desktop, Then the sidebar is visible with nav links
- Given I click a nav link, Then I navigate to that page and the active indicator moves
- Given I collapse the sidebar, Then it shrinks to 64px with icon-only nav and tooltips
- Given active runs exist, Then the sidebar widget shows them grouped by project with live elapsed time
- Given a run is awaiting_input, Then it shows with amber "Waiting for input" text at the top of the widget

**Mobile**
- Given screen < 640px, Then the sidebar is hidden and bottom nav is shown
- Given I tap the hamburger menu, Then a slide-in drawer opens with nav links
- Given I tap a nav item in bottom nav, Then I navigate to that page

**Search**
- Given I press Cmd+K, Then the search modal opens
- Given I type "my-app", Then matching projects, runs, and library items appear grouped by category
- Given I press Enter on a result, Then I navigate to that item's page
- Given I press Esc, Then the search modal closes

**Toasts**
- Given a mutation succeeds (e.g. commit), Then a success toast appears for 4 seconds
- Given a mutation fails, Then an error toast appears for 4 seconds
- Given a run enters awaiting_input, Then an action toast appears and persists until dismissed
- Given the run resumes, Then the action toast is automatically dismissed
- Given 6 toasts are triggered rapidly, Then only the 5 newest are visible

**Keyboard Shortcuts**
- Given I press Shift+?, Then the shortcuts overlay opens
- Given I press G then P, Then I navigate to the Projects page

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| AppShell + Sidebar (desktop, collapse, persist state) | M |
| BottomNav (mobile, 4 items, active indicator) | S |
| TopBar + Breadcrumb | S |
| GlobalSearchModal (search across 3 categories) | M |
| KeyboardShortcutsOverlay | S |
| ToastRegion + ToastStore (4 types, auto-dismiss, action toasts) | M |
| ActiveRunsWidget (grouped by project, live polling, awaiting_input) | M |
