"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { useProjects } from "@/hooks/use-projects"
import { ActiveRunsSection } from "./ActiveRunsSection"
import { RecentProjectsSection } from "./RecentProjectsSection"
import { RecentRunsSection } from "./RecentRunsSection"

function WelcomeState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h2 className="text-[22px] font-semibold text-[#dce8f5]">Welcome to Factory UI</h2>
      <p className="mt-2 text-sm text-[#8299b8] max-w-sm">
        Add your first project to get started. Factory UI runs Claude Code commands against your
        projects and helps you manage the results.
      </p>
      <Link
        href="/projects/new"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#4195e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#5aabf5] transition-colors"
      >
        <Plus size={16} />
        Add your first project
      </Link>
    </div>
  )
}

export function CockpitPage() {
  const { data: projects, isLoading } = useProjects()
  const hasProjects = !isLoading && (projects?.length ?? 0) > 0

  if (!isLoading && !hasProjects) {
    return (
      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <h1 className="text-[32px] font-bold tracking-[-1px] text-[#dce8f5]">Cockpit</h1>
        <WelcomeState />
      </div>
    )
  }

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8 space-y-8">
      <h1 className="text-[32px] font-bold tracking-[-1px] text-[#dce8f5]">Cockpit</h1>

      <div className="border border-[#263245] bg-[#192030] rounded-lg overflow-hidden">
        <ActiveRunsSection />
      </div>

      <div className="border border-[#263245] bg-[#192030] rounded-lg overflow-hidden">
        <RecentProjectsSection />
      </div>

      <div className="border border-[#263245] bg-[#192030] rounded-lg overflow-hidden">
        <RecentRunsSection />
      </div>
    </div>
  )
}
