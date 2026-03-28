"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useProjects } from "@/hooks/use-projects"
import { ProjectCard } from "@/components/project/ProjectCard"

const MAX_RECENT = 5

export function RecentProjectsSection() {
  const { data: projects, isLoading } = useProjects()

  // Sort by last_run_at descending; never-run projects go to end
  const sorted = projects
    ? [...projects]
        .sort((a, b) => {
          if (!a.lastRunAt && !b.lastRunAt) return 0
          if (!a.lastRunAt) return 1
          if (!b.lastRunAt) return -1
          return b.lastRunAt.localeCompare(a.lastRunAt)
        })
        .slice(0, MAX_RECENT)
    : []

  return (
    <section aria-label="Recent projects">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#263245]">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[#8299b8]">
          Recent Projects
        </h2>
        <Link
          href="/projects"
          className="flex items-center gap-1 text-xs text-[#4195e8] hover:text-[#5aabf5] transition-colors"
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-[#1f2a3e] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-[#607896]">No projects yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
