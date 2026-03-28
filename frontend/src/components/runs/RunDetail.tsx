"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react"
import { useRunDetail, useRunOutput, useDeleteRun } from "@/hooks/use-run-detail"
import { RunStatusBadge } from "./RunStatusBadge"
import { RunTypeBadge } from "./RunTypeBadge"
import { TerminalReplay } from "@/components/terminal/TerminalReplay"

function formatDuration(ms: number | undefined): string {
  if (!ms) return "—"
  const secs = ms / 1000
  if (secs < 60) return `${Math.round(secs)}s`
  const mins = Math.floor(secs / 60)
  const remSecs = Math.round(secs % 60)
  if (mins < 60) return remSecs > 0 ? `${mins}m ${remSecs}s` : `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

function formatRelative(isoStr: string | undefined): string {
  if (!isoStr) return "—"
  const diff = Date.now() - new Date(isoStr).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface MetaRowProps {
  label: string
  value: React.ReactNode
}

function MetaRow({ label, value }: MetaRowProps) {
  return (
    <div className="flex justify-between items-start gap-2 py-2 border-b border-[#263245] last:border-0">
      <span className="text-xs text-[#8299b8] shrink-0">{label}</span>
      <span className="text-xs text-[#dce8f5] text-right">{value}</span>
    </div>
  )
}

interface RunDetailProps {
  runId: string
}

export function RunDetail({ runId }: RunDetailProps) {
  const router = useRouter()
  const { data: run, isLoading, error } = useRunDetail(runId)
  const isCompleted = run?.status === "completed" || run?.status === "failed" || run?.status === "cancelled"
  const { data: outputB64 } = useRunOutput(runId, isCompleted)
  const deleteMutation = useDeleteRun()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#4195e8] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#f25c5c]">Run not found.</p>
        <Link href="/runs" className="mt-4 inline-block text-[#4195e8] hover:underline text-sm">
          ← Back to Run History
        </Link>
      </div>
    )
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    deleteMutation.mutate(runId, {
      onSuccess: () => router.push("/runs"),
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#263245]">
        <Link
          href="/runs"
          className="flex items-center gap-1 text-[#8299b8] hover:text-[#dce8f5] text-sm transition-colors"
        >
          <ArrowLeft size={14} />
          Run History
        </Link>
        <span className="text-[#263245]">/</span>
        <span className="text-sm font-mono text-[#dce8f5] truncate">
          {run.commandStem ? `/${run.commandStem}` : run.type === "raw" ? "Raw Terminal" : runId}
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Terminal area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {run.status === "awaiting_input" && (
            <div className="mx-4 mt-4 px-4 py-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center gap-2">
              <span className="text-xs text-[#f59e0b]">
                Waiting for your input —{" "}
                <Link href={`/projects/${run.projectId}`} className="underline hover:opacity-80">
                  open the project IDE to respond
                </Link>
              </span>
            </div>
          )}
          <div className="flex-1 overflow-hidden p-4">
            <TerminalReplay
              runId={runId}
              status={run.status}
              outputB64={outputB64}
            />
          </div>
        </div>

        {/* Details panel */}
        <aside className="w-72 border-l border-[#263245] bg-[#192030] p-4 overflow-y-auto flex-shrink-0">
          <h3 className="text-xs font-semibold text-[#8299b8] uppercase tracking-wider mb-3">Run Details</h3>

          <MetaRow label="Project" value={run.projectName ?? run.projectId} />
          <MetaRow label="Type" value={<RunTypeBadge type={run.type} />} />
          <MetaRow label="Status" value={<RunStatusBadge status={run.status} />} />
          <MetaRow label="Branch" value={<span className="font-mono">{run.branch ?? "main"}</span>} />
          <MetaRow label="Started" value={formatRelative(run.startedAt)} />
          <MetaRow label="Duration" value={formatDuration(run.durationMs)} />
          <MetaRow
            label="Cost"
            value={run.totalCostUsd != null ? `$${run.totalCostUsd.toFixed(4)}` : "—"}
          />
          {(run.inputTokens != null || run.outputTokens != null) && (
            <MetaRow
              label="Tokens"
              value={`↑ ${run.inputTokens?.toLocaleString() ?? 0}  ↓ ${run.outputTokens?.toLocaleString() ?? 0}`}
            />
          )}
          {run.numTurns != null && <MetaRow label="Turns" value={run.numTurns} />}
          {run.claudeSessionId && (
            <MetaRow
              label="Session"
              value={
                <span className="font-mono text-[10px] text-[#607896] break-all">
                  {run.sessionName ?? run.claudeSessionId}
                </span>
              }
            />
          )}

          {/* Actions */}
          <div className="mt-4 space-y-2">
            {run.claudeSessionId && (
              <Link
                href={`/projects/${run.projectId}?resume=${run.claudeSessionId}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-[#4195e8]
                  text-white text-sm font-medium hover:bg-[#5aabf5] transition-colors"
              >
                <RefreshCw size={14} />
                Resume Session
              </Link>
            )}

            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border
                border-[#f25c5c]/30 text-[#f25c5c] text-sm hover:bg-[#f25c5c]/10 transition-colors
                disabled:opacity-50"
            >
              <Trash2 size={14} />
              {confirmDelete ? "Confirm Delete?" : "Delete Run"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
