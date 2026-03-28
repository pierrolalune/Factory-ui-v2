"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Search, Menu } from "lucide-react"
import { useShellStore } from "@/store/shell-store"

const ROUTE_LABELS: Record<string, string> = {
  "/": "Cockpit",
  "/projects": "Projects",
  "/runs": "Runs",
  "/library": "Library",
  "/settings": "Settings",
}

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return [{ label: "Cockpit", href: "/" }]

  const crumbs: { label: string; href: string }[] = []
  let path = ""

  for (const segment of segments) {
    path += `/${segment}`
    const label = ROUTE_LABELS[path] ?? segment.replace(/-/g, " ")
    crumbs.push({ label, href: path })
  }

  return crumbs
}

export function TopBar() {
  const pathname = usePathname()
  const { setSearchOpen, setMobileMenuOpen } = useShellStore()
  const breadcrumbs = getBreadcrumbs(pathname)
  const currentLabel = breadcrumbs[breadcrumbs.length - 1]?.label ?? "Factory"

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[#263245] bg-[#192030] px-4">
      {/* Mobile: hamburger + page title */}
      <button
        className="flex h-9 w-9 items-center justify-center rounded-md text-[#8299b8]
          hover:bg-[#1f2a3e] hover:text-[#dce8f5] transition-colors md:hidden"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <span className="text-sm font-semibold text-[#dce8f5] md:hidden">{currentLabel}</span>

      {/* Desktop: breadcrumb */}
      <nav className="hidden md:flex items-center gap-1 text-sm" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, idx) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {idx > 0 && <span className="text-[#607896]">/</span>}
            {idx === breadcrumbs.length - 1 ? (
              <span className="text-[#dce8f5] font-medium">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-[#8299b8] hover:text-[#dce8f5] transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search shortcut hint */}
      <button
        className="hidden sm:flex items-center gap-2 rounded-md border border-[#263245]
          bg-[#1f2a3e] px-3 py-1.5 text-xs text-[#8299b8] hover:text-[#dce8f5] transition-colors"
        onClick={() => setSearchOpen(true)}
        aria-label="Open search (Cmd+K)"
      >
        <Search size={12} />
        <span>Search</span>
        <kbd className="text-[#607896]">⌘K</kbd>
      </button>
    </header>
  )
}
