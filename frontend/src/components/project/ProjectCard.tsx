"use client"

import Link from "next/link"
import { Circle, Check, X, Ban } from "lucide-react"
import type { ProjectSummary } from "@/lib/api/schemas/project"

interface ProjectCardProps {
  project: ProjectSummary
}

function StatusLine({ project }: { project: ProjectSummary }) {
  if (project.activeRunCount > 0) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[#5ecf3a]">
        <Circle size={8} className="fill-current animate-pulse" />
        Running ({project.activeRunCount})
      </span>
    )
  }

  if (!project.lastRunAt) {
    return <span className="text-xs text-[#607896]">Never run</span>
  }

  const statusIcon = {
    completed: <Check size={12} className="text-[#22c55e]" />,
    failed: <X size={12} className="text-[#f25c5c]" />,
    cancelled: <Ban size={12} className="text-[#8299b8]" />,
  }

  const elapsed = formatElapsed(project.lastRunAt)
  const cost =
    project.lastRunCostUsd != null ? ` · $${project.lastRunCostUsd.toFixed(2)}` : ""

  return (
    <span className="flex items-center gap-1 text-xs text-[#8299b8]">
      {project.lastRunStatus && statusIcon[project.lastRunStatus]}
      {elapsed}
      {cost}
    </span>
  )
}

function formatElapsed(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block border border-[#263245] bg-[#192030] rounded-lg p-4
        hover:bg-[#1f2a3e] transition-colors group"
    >
      <h3 className="text-sm font-semibold text-[#dce8f5] truncate group-hover:text-white transition-colors">
        {project.name}
      </h3>
      <p className="mt-1 text-xs text-[#8299b8] truncate font-mono">{project.path}</p>
      <div className="mt-3">
        <StatusLine project={project} />
      </div>
    </Link>
  )
}
