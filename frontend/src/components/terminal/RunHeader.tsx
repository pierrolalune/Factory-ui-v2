"use client"

import { useEffect, useState } from "react"
import { Terminal, GitBranch, X, Ban, Circle, Check, Zap } from "lucide-react"
import type { Run } from "@/lib/api/schemas/run"

interface RunHeaderProps {
  run: Run | null
  runId: string
  costUsd: number | null
  onCancel: () => void
  onClose: () => void
}

function formatElapsed(startedAt: string): string {
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider text-[#5ecf3a] border border-[#5ecf3a]/20">
        <Circle size={6} className="fill-[#5ecf3a]" />
        Active
      </span>
    )
  }
  if (status === "awaiting_input") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider text-[#f59e0b] border border-[#f59e0b]/20 animate-pulse">
        <Zap size={8} />
        Input needed
      </span>
    )
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider text-[#22c55e] border border-[#22c55e]/20">
        <Check size={8} />
        Completed
      </span>
    )
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider text-[#f25c5c] border border-[#f25c5c]/20">
        <X size={8} />
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider text-[#607896] border border-[#263245]">
      <Ban size={8} />
      {status}
    </span>
  )
}

/** Header bar for the terminal pane: run name, branch, effort, elapsed timer, cost, cancel/close. */
export function RunHeader({ run, runId, costUsd, onCancel, onClose }: RunHeaderProps) {
  const [elapsed, setElapsed] = useState<string>("")

  const isActive = run?.status === "active" || run?.status === "awaiting_input" || run?.status === "pending"

  useEffect(() => {
    if (!run?.startedAt || !isActive) return
    setElapsed(formatElapsed(run.startedAt))
    const id = setInterval(() => {
      if (run?.startedAt) setElapsed(formatElapsed(run.startedAt))
    }, 1_000)
    return () => clearInterval(id)
  }, [run?.startedAt, isActive])

  const label = run?.commandStem
    ? `/${run.commandStem}${run.commandArgs ? ` ${run.commandArgs}` : ""}`
    : (run?.type === "raw" ? "Raw Terminal" : runId)

  const displayCost = costUsd ?? run?.totalCostUsd
  const status = run?.status ?? "pending"

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[#263245] bg-[#192030] shrink-0 min-w-0">
      <Terminal size={14} className="text-[#8299b8] shrink-0" />

      {/* Run label */}
      <span className="text-sm font-mono text-[#dce8f5] truncate min-w-0">{label}</span>

      {/* Branch */}
      {run?.branch && (
        <span className="hidden md:flex items-center gap-1 text-xs text-[#607896] shrink-0">
          <GitBranch size={10} />
          {run.branch}
        </span>
      )}

      {/* Effort */}
      {run?.effort && (
        <span className="hidden md:inline text-xs text-[#607896] shrink-0">{run.effort}</span>
      )}

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <StatusBadge status={status} />

        {/* Elapsed timer (only while active) */}
        {isActive && elapsed && (
          <span className="text-xs font-mono text-[#8299b8] tabular-nums">{elapsed}</span>
        )}

        {/* Cost */}
        {displayCost != null && (
          <span className="text-xs font-mono text-[#607896]">${displayCost.toFixed(3)}</span>
        )}

        {/* Cancel button — only for active runs */}
        {isActive && (
          <button
            onClick={onCancel}
            className="text-xs text-[#f25c5c] hover:text-white hover:bg-red-950/40
              border border-[#263245] rounded px-2 py-1 transition-colors"
            aria-label="Cancel run"
          >
            Cancel
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="p-1 rounded text-[#607896] hover:text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
          aria-label="Close terminal"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
