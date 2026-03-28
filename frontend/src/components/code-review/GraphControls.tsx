"use client"

import { Loader2, RefreshCw, Search } from "lucide-react"
import { useBuildGraph } from "@/hooks/use-code-review"

export type GraphMode = "full" | "focus" | "modified"

const KIND_OPTIONS = [
  { value: "", label: "All kinds" },
  { value: "function", label: "function" },
  { value: "class", label: "class" },
  { value: "type", label: "type" },
  { value: "module", label: "module" },
  { value: "variable", label: "variable" },
  { value: "export", label: "export" },
]

const DEPTH_OPTIONS = [1, 2, 3]

interface GraphControlsProps {
  projectId: string
  mode: GraphMode
  onModeChange: (m: GraphMode) => void
  search: string
  onSearchChange: (s: string) => void
  kindFilter: string
  onKindFilterChange: (k: string) => void
  depth: number
  onDepthChange: (d: number) => void
}

export function GraphControls({
  projectId,
  mode,
  onModeChange,
  search,
  onSearchChange,
  kindFilter,
  onKindFilterChange,
  depth,
  onDepthChange,
}: GraphControlsProps) {
  const buildMutation = useBuildGraph(projectId)

  const RADIO_CLS = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
      active
        ? "bg-[#4195e8] text-white"
        : "bg-[#1f2a3e] border border-[#263245] text-[#a8bdd4] hover:text-[#dce8f5]"
    }`

  const SELECT_CLS =
    "px-3 py-1.5 text-xs bg-[#1f2a3e] border border-[#263245] text-[#dce8f5] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4195e8]"

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[#263245] bg-[#192030]">
      {/* Mode */}
      <div className="flex items-center gap-1">
        {(["full", "focus", "modified"] as GraphMode[]).map((m) => (
          <button key={m} className={RADIO_CLS(mode === m)} onClick={() => onModeChange(m)}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#607896]" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search nodes…"
          className="pl-8 pr-3 py-1.5 text-xs bg-[#1f2a3e] border border-[#263245] text-[#dce8f5]
            placeholder-[#607896] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4195e8] w-48"
        />
      </div>

      {/* Kind filter */}
      <select value={kindFilter} onChange={(e) => onKindFilterChange(e.target.value)} className={SELECT_CLS}>
        {KIND_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Depth (hidden in Full mode) */}
      {mode !== "full" && (
        <select
          value={depth}
          onChange={(e) => onDepthChange(Number(e.target.value))}
          className={SELECT_CLS}
        >
          {DEPTH_OPTIONS.map((d) => (
            <option key={d} value={d}>Depth {d}</option>
          ))}
        </select>
      )}

      {/* Rebuild */}
      <button
        onClick={() => buildMutation.mutate({ fullRebuild: true })}
        disabled={buildMutation.isPending}
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#263245]
          text-[#a8bdd4] rounded-lg hover:text-[#dce8f5] hover:border-[#4195e8] transition-colors
          disabled:opacity-50"
      >
        {buildMutation.isPending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <RefreshCw size={12} />
        )}
        Rebuild Graph
      </button>
    </div>
  )
}
