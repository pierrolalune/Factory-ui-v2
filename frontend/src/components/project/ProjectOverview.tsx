"use client"

import { Circle, Check, X, GitBranch } from "lucide-react"
import { useProject } from "@/hooks/use-projects"
import { useActiveRuns, useRecentRuns } from "@/hooks/use-runs"
import { useIDEStore } from "@/store/ide-store"
import type { RunSummary } from "@/lib/api/schemas/run"

interface ProjectOverviewProps {
  projectId: string
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function formatElapsed(startedAt: string): string {
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function ActiveRunRow({ run }: { run: RunSummary }) {
  const { focusRun } = useIDEStore()
  const label = run.commandStem ?? (run.type === "raw" ? "Raw Terminal" : run.id)
  const cost = run.costUsd != null ? `$${run.costUsd.toFixed(2)}` : null

  return (
    <button
      onClick={() => focusRun(run.id)}
      className="flex items-center gap-3 w-full text-left px-3 py-2 rounded hover:bg-[#1f2a3e] transition-colors"
    >
      <Circle size={8} className="fill-[#5ecf3a] text-[#5ecf3a] shrink-0 animate-pulse" />
      <span className="text-sm font-mono text-[#dce8f5] w-32 truncate">{run.branch ?? "main"}</span>
      <span className="text-sm text-[#a8bdd4] w-36 truncate">{label}</span>
      {cost && <span className="text-xs font-mono text-[#607896]">{cost}</span>}
      {run.phase && <span className="ml-auto text-xs text-[#8299b8] truncate max-w-xs">{run.phase}</span>}
    </button>
  )
}

function RecentRunRow({ run }: { run: RunSummary }) {
  const label = run.commandStem ?? (run.type === "raw" ? "Raw Terminal" : run.id)
  const isOk = run.status === "completed"
  const isFailed = run.status === "failed"
  const cost = run.costUsd != null ? `$${run.costUsd.toFixed(2)}` : "—"
  const duration = run.durationSeconds != null ? formatDuration(run.durationSeconds) : "—"
  const ago = run.startedAt ? formatElapsed(run.startedAt) : "—"

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {isOk ? (
        <Check size={14} className="text-[#22c55e] shrink-0" />
      ) : isFailed ? (
        <X size={14} className="text-[#f25c5c] shrink-0" />
      ) : (
        <X size={14} className="text-[#607896] shrink-0" />
      )}
      <span className="text-sm font-mono text-[#8299b8] w-28 truncate">{run.branch ?? "main"}</span>
      <span className="text-sm text-[#a8bdd4] w-32 truncate">{label}</span>
      <span className="text-xs font-mono text-[#607896]">{cost}</span>
      <span className="text-xs font-mono text-[#607896]">{duration}</span>
      <span className="ml-auto text-xs text-[#607896]">{ago}</span>
    </div>
  )
}

export function ProjectOverview({ projectId }: ProjectOverviewProps) {
  const { data: project } = useProject(projectId)
  const { data: activeRuns } = useActiveRuns(projectId)
  const { data: recentRuns } = useRecentRuns(5, projectId)

  const finished = recentRuns?.filter((r) => ["completed", "failed", "cancelled"].includes(r.status)) ?? []

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Project header */}
      <div>
        <h2 className="text-[22px] font-semibold text-[#dce8f5]">{project?.name ?? projectId}</h2>
        {project?.path && (
          <p className="mt-1 text-xs font-mono text-[#607896] truncate">{project.path}</p>
        )}
      </div>

      {/* Active Runs */}
      {(activeRuns?.length ?? 0) > 0 && (
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#8299b8] mb-2">
            Active Runs
          </h3>
          <div className="border border-[#263245] bg-[#192030] rounded-lg divide-y divide-[#263245]/50">
            {activeRuns!.map((run) => (
              <ActiveRunRow key={run.id} run={run} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Runs */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#8299b8] mb-2">
          Recent Runs
        </h3>
        {finished.length === 0 ? (
          <p className="text-sm text-[#607896]">No runs yet. Launch your first /cmd from the Launch tab.</p>
        ) : (
          <div className="border border-[#263245] bg-[#192030] rounded-lg divide-y divide-[#263245]/50">
            {finished.map((run) => (
              <RecentRunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </section>

      {/* Worktrees placeholder */}
      <section>
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#8299b8] mb-2 flex items-center gap-1.5">
          <GitBranch size={12} />
          Worktrees
        </h3>
        <div className="border border-[#263245] bg-[#192030] rounded-lg p-4">
          <p className="text-xs text-[#607896]">Worktree management coming in Sprint 5.</p>
        </div>
      </section>
    </div>
  )
}
