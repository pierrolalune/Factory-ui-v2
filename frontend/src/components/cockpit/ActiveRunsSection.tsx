"use client"

import { useRouter } from "next/navigation"
import { Zap, Circle } from "lucide-react"
import { useActiveRuns } from "@/hooks/use-runs"
import type { RunSummary } from "@/lib/api/schemas/run"
import { useEffect, useState } from "react"

function formatElapsed(startedAt: string): string {
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function useElapsed(startedAt: string | undefined): string {
  const [elapsed, setElapsed] = useState(() => (startedAt ? formatElapsed(startedAt) : ""))

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setElapsed(formatElapsed(startedAt)), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return elapsed
}

function ActiveRunRow({ run }: { run: RunSummary }) {
  const router = useRouter()
  const elapsed = useElapsed(run.startedAt)
  const isAwaiting = run.status === "awaiting_input"

  const label = run.commandStem ?? (run.type === "raw" ? "Raw Terminal" : run.id)
  const cost = run.costUsd != null ? `$${run.costUsd.toFixed(2)}` : null

  return (
    <button
      onClick={() => router.push(`/projects/${run.projectId}?focusRun=${run.id}`)}
      className={`w-full text-left px-4 py-3 border-b border-[#263245]/50 hover:bg-[#1f2a3e] transition-colors
        ${isAwaiting ? "border-l-2 border-l-[#f59e0b]" : ""}`}
    >
      <div className="flex items-center gap-3">
        {isAwaiting ? (
          <Zap size={14} className="text-[#f59e0b] shrink-0 animate-pulse" />
        ) : (
          <Circle size={10} className="fill-[#5ecf3a] text-[#5ecf3a] shrink-0 animate-pulse" />
        )}
        <span className="text-sm font-medium text-[#dce8f5]">{label}</span>
        <span className="text-xs text-[#8299b8]">{run.projectName ?? run.projectId}</span>
        {run.branch && (
          <span className="text-xs text-[#607896] font-mono">{run.branch}</span>
        )}
        <span className="ml-auto text-xs font-mono text-[#8299b8] tabular-nums">{elapsed}</span>
        {cost && <span className="text-xs font-mono text-[#8299b8]">{cost}</span>}
      </div>
      <div className="mt-1 ml-6 text-xs">
        {isAwaiting ? (
          <span className="text-[#f59e0b]">Waiting for your input</span>
        ) : run.phase ? (
          <span className="text-[#8299b8]">{run.phase}</span>
        ) : (
          <span className="text-[#607896]">Thinking...</span>
        )}
      </div>
    </button>
  )
}

// Sort: awaiting_input first, then active, newest first
function sortActiveRuns(runs: RunSummary[]): RunSummary[] {
  return [...runs].sort((a, b) => {
    if (a.status === "awaiting_input" && b.status !== "awaiting_input") return -1
    if (b.status === "awaiting_input" && a.status !== "awaiting_input") return 1
    return (b.startedAt ?? "").localeCompare(a.startedAt ?? "")
  })
}

export function ActiveRunsSection() {
  const { data: runs, isLoading } = useActiveRuns()
  const sorted = runs ? sortActiveRuns(runs) : []

  // Hide section entirely when no active runs
  if (!isLoading && sorted.length === 0) return null

  return (
    <section aria-label="Active runs">
      <h2 className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-[#8299b8] border-b border-[#263245]">
        Active Runs
      </h2>
      <div>
        {isLoading ? (
          <div className="px-4 py-3 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-[#1f2a3e] rounded animate-pulse" />
            ))}
          </div>
        ) : (
          sorted.map((run) => <ActiveRunRow key={run.id} run={run} />)
        )}
      </div>
    </section>
  )
}
