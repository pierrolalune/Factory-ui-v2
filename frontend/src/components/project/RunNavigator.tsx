"use client"

import { List, FolderOpen } from "lucide-react"
import { useIDEStore } from "@/store/ide-store"
import { useActiveRuns, useRecentRuns } from "@/hooks/use-runs"
import { RunCard } from "./RunCard"
import { FileTree } from "./FileTree"
import type { RunSummary } from "@/lib/api/schemas/run"

interface RunNavigatorProps {
  projectId: string
}

function groupRunsByBranch(runs: RunSummary[]): Map<string, RunSummary[]> {
  const groups = new Map<string, RunSummary[]>()
  for (const run of runs) {
    const branch = run.branch ?? "main"
    const existing = groups.get(branch) ?? []
    groups.set(branch, [...existing, run])
  }
  return groups
}

function RunsMode({ projectId }: { projectId: string }) {
  const { data: activeRuns } = useActiveRuns(projectId)
  const { data: recentRuns } = useRecentRuns(20, projectId)

  // Merge active and recent, deduplicating by id; active runs take priority
  const activeIds = new Set((activeRuns ?? []).map((r) => r.id))
  const allRuns = [
    ...(activeRuns ?? []),
    ...(recentRuns ?? []).filter((r) => !activeIds.has(r.id)),
  ]

  if (allRuns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-[#607896] text-center">
          No runs yet for this project.{"\n"}Launch your first /cmd from the Launch tab.
        </p>
      </div>
    )
  }

  const groups = groupRunsByBranch(allRuns)

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      {Array.from(groups.entries()).map(([branch, runs]) => (
        <div key={branch}>
          <p className="text-xs font-medium text-[#607896] uppercase tracking-wider mb-2 px-1">
            {branch}
          </p>
          <div className="space-y-2">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RunNavigator({ projectId }: RunNavigatorProps) {
  const { leftMode, setLeftMode } = useIDEStore()

  return (
    <div className="flex flex-col h-full border-r border-[#263245] bg-[#192030]">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-[#263245] shrink-0">
        <p className="text-xs font-semibold text-[#8299b8] uppercase tracking-wider">
          {leftMode === "runs" ? "Runs" : "Files"}
        </p>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {leftMode === "runs" ? (
          <RunsMode projectId={projectId} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <FileTree projectId={projectId} />
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div className="shrink-0 border-t border-[#263245] flex">
        <button
          onClick={() => setLeftMode("runs")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
            ${leftMode === "runs" ? "text-[#4195e8] border-t-2 border-t-[#4195e8] -mt-px" : "text-[#607896] hover:text-[#a8bdd4]"}`}
        >
          <List size={14} />
          Runs
        </button>
        <button
          onClick={() => setLeftMode("files")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
            ${leftMode === "files" ? "text-[#4195e8] border-t-2 border-t-[#4195e8] -mt-px" : "text-[#607896] hover:text-[#a8bdd4]"}`}
        >
          <FolderOpen size={14} />
          Files
        </button>
      </div>
    </div>
  )
}
