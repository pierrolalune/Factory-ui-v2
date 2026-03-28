"use client"

import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"
import { TopBar } from "./TopBar"
import { ToastRegion } from "./ToastRegion"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#10161f]">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main area: topbar + scrollable content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-14 sm:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Toast notifications */}
      <ToastRegion />
    </div>
  )
}
