"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { useProjects } from "@/hooks/use-projects"
import { ProjectsGrid } from "./ProjectsGrid"

function SkeletonCard() {
  return (
    <div className="border border-[#263245] bg-[#192030] rounded-lg p-4 space-y-3 animate-pulse">
      <div className="h-4 w-2/3 rounded bg-[#1f2a3e]" />
      <div className="h-3 w-full rounded bg-[#1f2a3e]" />
      <div className="h-3 w-1/3 rounded bg-[#1f2a3e]" />
    </div>
  )
}

export function ProjectsBrowser() {
  const { data: projects, isLoading, error } = useProjects()

  return (
    <div className="p-6 max-w-[1280px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[32px] font-bold tracking-[-1px] text-[#dce8f5]">Projects</h1>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#4195e8] px-4 py-2
            text-sm font-medium text-white hover:bg-[#5aabf5] transition-colors"
        >
          <Plus size={16} />
          New Project
        </Link>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-[#f25c5c]/30 bg-red-950/20 p-4 text-sm text-[#f25c5c]">
          Failed to load projects. Make sure the backend is running.
        </div>
      )}

      {/* Projects grid */}
      {projects && <ProjectsGrid projects={projects} />}
    </div>
  )
}
