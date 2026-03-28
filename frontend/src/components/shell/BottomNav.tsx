"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, FolderKanban, Terminal, Library } from "lucide-react"

interface BottomNavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number }>
  exact?: boolean
}

const ITEMS: BottomNavItem[] = [
  { label: "Cockpit", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Runs", href: "/runs", icon: Terminal },
  { label: "Library", href: "/library", icon: Library },
]

export function BottomNav() {
  const pathname = usePathname()

  function isActive(item: BottomNavItem): boolean {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(`${item.href}/`)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center
        justify-around border-t border-[#263245] bg-[#192030] sm:hidden"
      aria-label="Mobile navigation"
    >
      {ITEMS.map((item) => {
        const active = isActive(item)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 px-3 text-xs font-medium transition-colors",
              active ? "text-[#4195e8]" : "text-[#8299b8]",
            ].join(" ")}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
