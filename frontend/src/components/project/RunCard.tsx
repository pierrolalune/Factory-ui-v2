"use client"

import { useEffect, useState } from "react"
import { Circle, Check, X, Ban, Zap } from "lucide-react"
import { useIDEStore } from "@/store/ide-store"
import type { RunSummary } from "@/lib/api/schemas/run"

interface RunCardProps {
  run: RunSummary
}

function formatElapsed(startedAt: string | undefined, completedAt: string | undefined): string {
  if (!startedAt) return ""
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const secs = Math.floor((end - new Date(startedAt).getTime()) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function RunStatusIcon({ status }: { status: string }) {
  if (status === "active") return <Circle size={8} className="fill-[#5ecf3a] text-[#5ecf3a] animate-pulse" />
  if (status === "awaiting_input") return <Zap size={10} className="text-[#f59e0b] animate-pulse" />
  if (status === "completed") return <Check size={12} className="text-[#22c55e]" />
  if (status === "failed") return <X size={12} className="text-[#f25c5c]" />
  return <Ban size={12} className="text-[#607896]" />
}

export function RunCard({ run }: RunCardProps) {
  const { focusedRunId, focusRun } = useIDEStore()
  const isFocused = focusedRunId === run.id
  const isActive = run.status === "active" || run.status === "awaiting_input"
  const isAwaiting = run.status === "awaiting_input"

  const [elapsed, setElapsed] = useState(() => formatElapsed(run.startedAt, run.completedAt))
  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => setElapsed(formatElapsed(run.startedAt, run.completedAt)), 1000)
    return () => clearInterval(id)
  }, [isActive, run.startedAt, run.completedAt])

  const label = run.commandStem ?? (run.type === "raw" ? "Raw Terminal" : run.id)
  const cost = run.costUsd != null ? `$${run.costUsd.toFixed(2)}` : null

  return (
    <button
      onClick={() => focusRun(run.id)}
      className={`w-full text-left rounded-lg border p-3 transition-colors
        ${isFocused ? "border-[#4195e8] bg-[#1f2a3e]" : "border-[#263245] bg-[#192030] hover:bg-[#1f2a3e]"}
        ${isAwaiting ? "border-l-2 border-l-[#f59e0b]" : ""}`}
    >
      <div className="flex items-center gap-2">
        <RunStatusIcon status={run.status} />
        <span className="text-sm font-medium text-[#dce8f5] truncate">{label}</span>
        <span className="ml-auto text-xs font-mono text-[#8299b8] tabular-nums shrink-0">{elapsed}</span>
        {cost && <span className="text-xs font-mono text-[#607896] shrink-0">{cost}</span>}
      </div>
      {run.phase && (
        <p className="mt-1 text-xs text-[#8299b8] truncate pl-4">
          {isAwaiting ? (
            <span className="text-[#f59e0b]">Waiting for your input</span>
          ) : (
            run.phase
          )}
        </p>
      )}
    </button>
  )
}
