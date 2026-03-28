"use client"

import Link from "next/link"
import { Check, X, Ban, ChevronRight } from "lucide-react"
import { useRecentRuns } from "@/hooks/use-runs"
import type { RunSummary } from "@/lib/api/schemas/run"

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <Check size={14} className="text-[#22c55e]" />
  if (status === "failed") return <X size={14} className="text-[#f25c5c]" />
  return <Ban size={14} className="text-[#607896]" />
}

function RunRow({ run }: { run: RunSummary }) {
  const label = run.commandStem
    ? `${run.commandStem}${run.commandArgs ? ` ${run.commandArgs}` : ""}`
    : run.type === "raw"
      ? "Raw Terminal"
      : run.id
  const truncatedLabel = label.length > 32 ? `${label.slice(0, 30)}…` : label
  const cost = run.costUsd != null ? `$${run.costUsd.toFixed(2)}` : "—"
  const duration = run.durationSeconds != null ? formatDuration(run.durationSeconds) : "—"

  return (
    <tr className="border-b border-[#263245]/50 hover:bg-[#1f2a3e] transition-colors">
      <td className="py-3 px-4 text-sm text-[#dce8f5]">
        <Link href={`/projects/${run.projectId}`} className="hover:text-[#4195e8] transition-colors">
          {run.projectName ?? run.projectId}
        </Link>
      </td>
      <td className="py-3 px-4 text-sm">
        <Link
          href={`/runs/${run.id}`}
          className="font-mono text-[#dce8f5] hover:text-[#4195e8] transition-colors"
        >
          {truncatedLabel}
        </Link>
      </td>
      <td className="py-3 px-4 text-sm font-mono text-[#8299b8]">{run.branch ?? "main"}</td>
      <td className="py-3 px-4">
        <StatusIcon status={run.status} />
      </td>
      <td className="py-3 px-4 text-sm font-mono text-[#8299b8] tabular-nums">{duration}</td>
      <td className="py-3 px-4 text-sm font-mono text-[#8299b8] tabular-nums">{cost}</td>
    </tr>
  )
}

export function RecentRunsSection() {
  const { data: runs, isLoading } = useRecentRuns(10)
  // Filter to only completed/failed/cancelled
  const finished = runs?.filter((r) => ["completed", "failed", "cancelled"].includes(r.status)) ?? []

  return (
    <section aria-label="Recent runs">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#263245]">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[#8299b8]">Recent Runs</h2>
        <Link
          href="/runs"
          className="flex items-center gap-1 text-xs text-[#4195e8] hover:text-[#5aabf5] transition-colors"
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-[#1f2a3e] rounded animate-pulse" />
            ))}
          </div>
        ) : finished.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-[#607896]">No runs yet. Launch your first run from a project.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#263245]">
                {["Project", "Run", "Branch", "Status", "Duration", "Cost"].map((h) => (
                  <th
                    key={h}
                    className="py-2 px-4 text-left text-xs font-medium uppercase tracking-wider text-[#8299b8]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finished.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
