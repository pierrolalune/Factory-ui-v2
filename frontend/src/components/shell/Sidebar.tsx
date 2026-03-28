"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  Terminal,
  Library,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useShellStore } from "@/store/shell-store"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: "Cockpit", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Runs", href: "/runs", icon: Terminal },
  { label: "Library", href: "/library", icon: Library },
]

const SETTINGS_ITEM: NavItem = { label: "Settings", href: "/settings", icon: Settings }

function NavLink({
  item,
  collapsed,
  active,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={[
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-l-2 border-[#4195e8] bg-[#1f2a3e] text-[#dce8f5]"
          : "border-l-2 border-transparent text-[#8299b8] hover:bg-[#1f2a3e] hover:text-[#dce8f5]",
        collapsed ? "justify-center px-0" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span>{item.label}</span>}
      {/* Tooltip for collapsed state */}
      {collapsed && (
        <span
          className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md
            bg-[#1f2a3e] px-2 py-1 text-xs text-[#dce8f5] opacity-0 shadow-md
            transition-opacity group-hover:opacity-100"
        >
          {item.label}
        </span>
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useShellStore()

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }

  return (
    <aside
      className={[
        "hidden md:flex flex-col shrink-0 bg-[#192030] border-r border-[#263245] transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-60",
      ].join(" ")}
    >
      {/* Logo + collapse toggle */}
      <div
        className={[
          "flex items-center border-b border-[#263245] h-14 px-4",
          sidebarCollapsed ? "justify-center" : "justify-between",
        ].join(" ")}
      >
        {!sidebarCollapsed && (
          <span className="text-sm font-bold tracking-widest text-[#4195e8]">FACTORY</span>
        )}
        <button
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#8299b8]
            hover:bg-[#1f2a3e] hover:text-[#dce8f5] transition-colors"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} collapsed={sidebarCollapsed} active={isActive(item)} />
        ))}
      </nav>

      {/* Divider + Settings */}
      <div className="border-t border-[#263245] p-2">
        <NavLink item={SETTINGS_ITEM} collapsed={sidebarCollapsed} active={isActive(SETTINGS_ITEM)} />
      </div>
    </aside>
  )
}
