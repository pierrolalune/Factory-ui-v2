"use client"

import { useState } from "react"
import { History, Search, X } from "lucide-react"
import { useRuns } from "@/hooks/use-runs"
import { useProjects } from "@/hooks/use-projects"
import { RunsTable } from "@/components/runs/RunsTable"
import type { RunSummary } from "@/lib/api/schemas/run"

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "awaiting_input", label: "Awaiting Input" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
]

const PAGE_SIZE = 50

function filterBySearch(runs: RunSummary[], query: string): RunSummary[] {
  if (!query) return runs
  const q = query.toLowerCase()
  return runs.filter((r) => {
    const preview =
      r.type === "raw"
        ? "raw claude terminal"
        : `/${r.commandStem ?? ""} ${r.commandArgs ?? ""}`.toLowerCase()
    return preview.includes(q) || (r.projectName ?? "").toLowerCase().includes(q)
  })
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <div className="space-y-0">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-14 bg-[#1f2a3e] animate-pulse border-b border-[#263245]" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  hasFilters: boolean
  onClear: () => void
}

function EmptyState({ hasFilters, onClear }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <History size={40} className="text-[#263245] mb-4" />
      {hasFilters ? (
        <>
          <p className="text-[#8299b8]">No runs match your filters.</p>
          <button
            onClick={onClear}
            className="mt-3 text-sm text-[#4195e8] hover:underline"
          >
            Clear filters
          </button>
        </>
      ) : (
        <>
          <p className="text-[#8299b8]">No runs yet.</p>
          <p className="text-sm text-[#607896] mt-1">
            Launch your first run from a project.
          </p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RunsPage() {
  const [projectFilter, setProjectFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const { data: projects } = useProjects()
  const { data: allRuns, isLoading } = useRuns({
    projectId: projectFilter || undefined,
    status: statusFilter || undefined,
    sort: "started_at_desc",
  })

  const filtered = filterBySearch(allRuns ?? [], searchQuery)
  // Active/awaiting runs always at top
  const sorted = [
    ...filtered.filter((r) => r.status === "active" || r.status === "awaiting_input"),
    ...filtered.filter((r) => r.status !== "active" && r.status !== "awaiting_input"),
  ]
  const visible = sorted.slice(0, visibleCount)
  const hasMore = sorted.length > visibleCount
  const hasFilters = Boolean(projectFilter || statusFilter || searchQuery)

  const SELECT_CLS =
    "px-3 py-2 text-sm bg-[#1f2a3e] border border-[#263245] text-[#dce8f5] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4195e8]"

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#263245]">
        <h1 className="text-2xl font-bold tracking-tight text-[#dce8f5]">Run History</h1>
        <p className="text-sm text-[#8299b8] mt-0.5">All Claude runs across your projects</p>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-[#263245] flex flex-wrap items-center gap-3">
        {/* Project filter */}
        <select
          value={projectFilter}
          onChange={(e) => { setProjectFilter(e.target.value); setVisibleCount(PAGE_SIZE) }}
          className={SELECT_CLS}
        >
          <option value="">All Projects</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setVisibleCount(PAGE_SIZE) }}
          className={SELECT_CLS}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607896]" />
          <input
            type="text"
            placeholder="Search runs…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE) }}
            className="w-full pl-9 pr-3 py-2 text-sm bg-[#1f2a3e] border border-[#263245] text-[#dce8f5]
              placeholder-[#607896] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4195e8]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#607896] hover:text-[#dce8f5]"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <SkeletonRows />
        ) : sorted.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters}
            onClear={() => {
              setProjectFilter("")
              setStatusFilter("")
              setSearchQuery("")
            }}
          />
        ) : (
          <>
            <RunsTable runs={visible} />
            {hasMore && (
              <div className="px-6 py-4 border-t border-[#263245]">
                <button
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="text-sm text-[#4195e8] hover:underline"
                >
                  Load more ({sorted.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
