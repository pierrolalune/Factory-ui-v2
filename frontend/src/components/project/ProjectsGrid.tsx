"use client"

import Link from "next/link"
import { Plus, FolderKanban } from "lucide-react"
import { ProjectCard } from "./ProjectCard"
import type { ProjectSummary } from "@/lib/api/schemas/project"

interface ProjectsGridProps {
  projects: ProjectSummary[]
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1f2a3e] mb-4">
        <FolderKanban size={28} className="text-[#607896]" />
      </div>
      <h3 className="text-sm font-semibold text-[#dce8f5]">No projects yet</h3>
      <p className="mt-1 text-sm text-[#8299b8]">Add your first project to get started.</p>
      <Link
        href="/projects/new"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#4195e8] px-4 py-2
          text-sm font-medium text-white hover:bg-[#5aabf5] transition-colors"
      >
        <Plus size={16} />
        Add Project
      </Link>
    </div>
  )
}

export function ProjectsGrid({ projects }: ProjectsGridProps) {
  if (projects.length === 0) return <EmptyState />

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
