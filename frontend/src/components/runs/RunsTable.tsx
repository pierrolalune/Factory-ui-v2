"use client"

import Link from "next/link"
import { RefreshCw } from "lucide-react"
import type { RunSummary } from "@/lib/api/schemas/run"
import { RunStatusBadge } from "./RunStatusBadge"
import { RunTypeBadge } from "./RunTypeBadge"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return "—"
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hrs}h ${remMins}m`
}

function promptPreview(run: RunSummary): string {
  if (run.type === "raw") return "Raw Claude Terminal"
  if (run.commandStem) {
    const full = `/${run.commandStem}${run.commandArgs ? ` ${run.commandArgs}` : ""}`
    return full.length > 80 ? `${full.slice(0, 77)}...` : full
  }
  return "—"
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------

interface RowProps {
  run: RunSummary
  onResume?: (run: RunSummary) => void
}

function RunRow({ run, onResume }: RowProps) {
  const isLive = run.status === "active" || run.status === "awaiting_input"
  return (
    <tr
      className={`border-b border-[#263245] hover:bg-[#1f2a3e] transition-colors ${isLive ? "bg-[#192030]" : ""}`}
    >
      {/* Project */}
      <td className="px-4 py-3">
        <span className="text-sm text-[#a8bdd4]">{run.projectName ?? run.projectId}</span>
      </td>

      {/* Run */}
      <td className="px-4 py-3">
        <Link
          href={`/runs/${run.id}`}
          className="group flex flex-col gap-0.5"
        >
          <div className="flex items-center gap-2">
            <RunTypeBadge type={run.type} />
            <span className="text-sm text-[#dce8f5] group-hover:text-[#4195e8] transition-colors truncate max-w-[200px]">
              {promptPreview(run)}
            </span>
          </div>
        </Link>
      </td>

      {/* Branch */}
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-[#8299b8]">{run.branch ?? "main"}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <RunStatusBadge status={run.status} />
      </td>

      {/* Duration */}
      <td className="px-4 py-3">
        <span className="text-sm text-[#8299b8] tabular-nums">{formatDuration(run.durationSeconds)}</span>
      </td>

      {/* Cost */}
      <td className="px-4 py-3">
        <span className="text-sm text-[#8299b8] tabular-nums">
          {run.costUsd != null ? `$${run.costUsd.toFixed(4)}` : "—"}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {run.status === "completed" && (
          <button
            onClick={() => onResume?.(run)}
            title="Resume session"
            className="p-1.5 rounded text-[#607896] hover:text-[#4195e8] hover:bg-[#263245] transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Table header
// ---------------------------------------------------------------------------

const TH_CLS = "px-4 py-3 text-left text-[#8299b8] text-xs font-medium uppercase tracking-wider"

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RunsTableProps {
  runs: RunSummary[]
  onResume?: (run: RunSummary) => void
}

export function RunsTable({ runs, onResume }: RunsTableProps) {
  if (runs.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#263245]">
            <th className={TH_CLS}>Project</th>
            <th className={TH_CLS}>Run</th>
            <th className={TH_CLS}>Branch</th>
            <th className={TH_CLS}>Status</th>
            <th className={TH_CLS}>Duration</th>
            <th className={TH_CLS}>Cost</th>
            <th className={`${TH_CLS} w-12`} />
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <RunRow key={run.id} run={run} onResume={onResume} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
