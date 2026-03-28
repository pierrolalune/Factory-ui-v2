# Factory UI V2 — Design System

All UI components must follow this design system. Reference this document when building any visual element.

---

## Colors

### Surfaces

| Token | Hex | Usage |
|---|---|---|
| `bg-body` | `#10161f` | Page background, app root |
| `bg-surface` | `#192030` | Cards, panels, sidebar |
| `bg-elevated` | `#1f2a3e` | Hover states, input backgrounds, dropdowns |
| `bg-border` | `#263245` | All borders, dividers, separators |

### Text

| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#dce8f5` | Primary text, headings, labels |
| `text-secondary` | `#a8bdd4` | Descriptions, secondary info |
| `text-muted` | `#8299b8` | Timestamps, hints, placeholders |
| `text-faint` | `#607896` | Disabled text, subtle labels |

### Accent — Sapphire (Primary)

| Token | Hex | Usage |
|---|---|---|
| `sapphire-400` | `#5aabf5` | Hover states, lighter accents |
| `sapphire-500` | `#4195e8` | Active states, CTAs, selected items, focus rings, links |
| `sapphire-600` | `#2678d4` | Pressed states |

Used for: buttons (primary), active nav items, selected tabs, focus rings, links, badges.

### Accent — Lime (Running State)

| Token | Hex | Usage |
|---|---|---|
| `lime-400` | `#7fd447` | Lighter running indicator |
| `lime-500` | `#5ecf3a` | Active/running run indicators ONLY |
| `lime-600` | `#3a8a1e` | Darker running state |

ONLY used for live/active run indicators. Never for buttons, links, or general UI.

### Accent — Amber (Awaiting Input)

| Token | Hex | Usage |
|---|---|---|
| `amber-500` | `#f59e0b` | Awaiting input indicators, pulsing badges |

Used exclusively for `awaiting_input` run state — runs that need user attention.

### Semantic

| Token | Hex | Usage |
|---|---|---|
| `red-500` | `#f25c5c` | Error, failed, destructive actions |
| `orange-500` | `#f97316` | Warning |
| `yellow-500` | `#eab308` | Caution |
| `blue-500` | `#3b82f6` | Info |
| `green-500` | `#22c55e` | Success (toasts, confirmations) |

---

## Typography

### Font Families

| Token | Font | Usage |
|---|---|---|
| `--font-dm-sans` | DM Sans | All UI text: headings, labels, body, buttons |
| `--font-dm-mono` | DM Mono | Code, terminal, file paths, data tables, monospace values |

DM Mono must use `font-variant-numeric: tabular-nums` for aligned columns.

### Scale

| Name | Size | Weight | Tracking | Usage |
|---|---|---|---|---|
| display | 48px | 700 | -1.5px | Hero sections (cockpit greeting) |
| h1 | 32px | 700 | -1.0px | Page titles |
| h2 | 22px | 600 | -0.5px | Section headers |
| h3 | 18px | 600 | 0 | Card titles, panel headers |
| body | 14px | 400 | 0 | Default text |
| small | 12px | 400 | 0 | Timestamps, badges, secondary labels |
| micro | 10px | 500 | 0.5px | Status indicators, uppercase labels |

### Weights

| Weight | Value | Usage |
|---|---|---|
| normal | 400 | Body text, descriptions |
| medium | 500 | Labels, nav items |
| semibold | 600 | Headings, emphasis |
| bold | 700 | Display, h1 |

---

## Spacing

Base unit: 8px. All spacing should be multiples of 4px.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Tight gaps (icon-to-text, badge padding) |
| `space-2` | 8px | Default gap, small padding |
| `space-3` | 12px | Between related elements |
| `space-4` | 16px | Card padding, section gaps |
| `space-6` | 24px | Between sections, modal padding |
| `space-8` | 32px | Large section spacing |
| `space-12` | 48px | Page-level spacing |

### Common Padding

| Context | Padding |
|---|---|
| Buttons | 8px 16px |
| Inputs | 8px 12px |
| Cards | 16px 24px |
| Modals | 24px 32px |
| Page content | 24px |

---

## Layout

### Grid

- 12-column grid
- 24px gutters
- 16px margins (mobile), 24px (desktop)

### Max Widths

| Context | Max Width |
|---|---|
| Cockpit / dashboard | 1280px |
| Settings / forms | 960px |
| Full-screen (code review) | 100% |

### Panel Sizes

| Panel | Width |
|---|---|
| Sidebar (expanded) | 240px |
| Sidebar (collapsed) | 64px |
| Run Navigator (left, IDE) | 280px |
| Right Panel (IDE) | 340px |
| Node Detail (code review) | 320px |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Badges, small pills, inline tags |
| `radius-md` | 8px | Buttons, inputs, dropdowns |
| `radius-lg` | 12px | Cards, panels |
| `radius-xl` | 16px | Modals, dialogs |
| `radius-full` | 9999px | Avatar, dot indicators, circular badges |

---

## Shadows

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle elevation (tooltips) |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | Cards, dropdowns |
| `shadow-lg` | `0 8px 32px rgba(0,0,0,0.6)` | Modals, overlays |

---

## Component Patterns

### Buttons

```
Default:    border border-[#263245] bg-transparent hover:bg-[#1f2a3e] text-[#dce8f5]
Primary:    bg-[#4195e8] hover:bg-[#5aabf5] text-white border-none
Danger:     text-[#f25c5c] hover:bg-red-950/40 border border-[#263245]
Disabled:   opacity-50 cursor-not-allowed
```

All buttons: `rounded-lg px-4 py-2 text-sm font-medium transition-colors`

### Inputs

```
border border-[#263245] bg-[#1f2a3e] text-[#dce8f5]
placeholder:text-[#607896]
focus:ring-2 focus:ring-[#4195e8] focus:border-[#4195e8]
rounded-lg px-3 py-2 text-sm
```

### Cards

```
border border-[#263245] bg-[#192030] rounded-lg p-4
hover:bg-[#1f2a3e] (if clickable)
```

### Modals

```
bg-[#192030] border border-[#263245] rounded-xl shadow-lg
Backdrop: bg-black/50
Max width: 640px (standard), 480px (confirm), 800px (large)
```

### Badges

```
inline-flex items-center rounded-full px-2.5 py-1
text-[10px] font-medium uppercase tracking-wider
border border-current/20
```

Badge colors by context:
- Type badges: command (sapphire), workflow (purple #8b5cf6), skill (teal #14b8a6), claude-md (amber #f59e0b)
- Source badges: builtin (muted border), mine (green outline), imported (grey outline)
- Status badges: active (lime), completed (green), failed (red), cancelled (grey), awaiting_input (amber)

### Tables

```
Header:  text-[#8299b8] text-xs font-medium uppercase tracking-wider border-b border-[#263245]
Row:     border-b border-[#263245]/50 hover:bg-[#1f2a3e]
Cell:    py-3 px-4 text-sm text-[#dce8f5]
```

---

## Animations

| Name | Duration | Usage |
|---|---|---|
| `pulse` | 2s, infinite | Loading skeletons, live indicators |
| `shimmer` | 1.5s, infinite | Active run progress bars |
| `fade-in-up` | 200ms, ease-out | Page/section enter transitions |
| `spin` | 1s, linear, infinite | Loading spinners |

### Skeleton Loading

```
bg-[#1f2a3e] rounded animate-pulse
```

Use skeleton blocks matching the shape of the content they replace.

---

## Toast Notifications

- Position: bottom-right corner, 16px from edges
- Stack: newest on top, max 5 visible
- Width: 360px

| Type | Icon | Border Color | Auto-dismiss |
|---|---|---|---|
| success | Checkmark | `#22c55e` | 4 seconds |
| error | X circle | `#f25c5c` | 4 seconds |
| info | Info circle | `#3b82f6` | 4 seconds |
| action | Bell | `#f59e0b` | Never (manual dismiss) |

Action toasts are used for `awaiting_input` runs. They persist until the user dismisses them or the run resumes.

---

## Responsive Breakpoints

| Token | Width | Behavior |
|---|---|---|
| `sm` | 640px | Mobile bottom nav appears |
| `md` | 768px | Sidebar collapses to icons |
| `lg` | 1024px | Right panel visible by default |
| `xl` | 1280px | Full 3-panel IDE layout |

### Mobile (< 640px)

- Sidebar hidden, bottom navigation visible
- Bottom nav: 4 items (Cockpit, Projects, Runs, Library)
- Terminal: full-screen overlay
- Panels stack vertically
- Font size: body 14px (unchanged), terminal 12px

### Tablet (640px - 1023px)

- Sidebar collapsed to 64px icons
- Right panel hidden, toggled via header icon
- 2-column project grid

### Desktop (>= 1024px)

- Full sidebar (240px, collapsible)
- 3-panel IDE layout
- 3-column project grid

---

## Accessibility

- Focus rings: `ring-2 ring-[#4195e8] ring-offset-2 ring-offset-[#10161f]`
- Icon-only buttons: must have `aria-label`
- Keyboard navigation: roving tabindex for tab bars and menus
- Color contrast: all text/background combinations meet WCAG AA (4.5:1 for body, 3:1 for large text)
- Interactive elements: minimum 44x44px touch target on mobile
- Screen reader: status changes (run state, toast) use `aria-live="polite"`

---

## Icon Library

Use Lucide React icons consistently. Common icons:

| Context | Icon |
|---|---|
| Projects | `FolderKanban` |
| Runs / Terminal | `Terminal` |
| Library | `Library` |
| Settings | `Settings` |
| Cockpit | `LayoutDashboard` |
| Active run | `Circle` (filled, lime) |
| Awaiting input | `Zap` (amber) |
| Completed | `Check` |
| Failed | `X` |
| Cancelled | `Ban` |
| Git branch | `GitBranch` |
| Search | `Search` |
| Close | `X` |
| Menu | `Menu` |
| Chevron | `ChevronRight`, `ChevronDown` |
