"use client"

import { FileCode, X } from "lucide-react"
import { useImpactAnalysis } from "@/hooks/use-code-review"
import type { GraphNode } from "@/lib/api/schemas/code-review"

interface ImpactPanelProps {
  projectId: string
  selectedNode: GraphNode | null
  allNodes: GraphNode[]
  allEdges: Array<{ source: string; target: string; type: string }>
  onClose: () => void
  onFocusNode: (nodeId: string) => void
}

const KIND_COLORS: Record<string, string> = {
  function: "#4195e8",
  class: "#8b5cf6",
  type: "#14b8a6",
  module: "#6b7280",
  variable: "#f59e0b",
  export: "#22c55e",
}

function KindBadge({ kind }: { kind: string }) {
  const color = KIND_COLORS[kind] ?? "#607896"
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ color, backgroundColor: `${color}20` }}
    >
      {kind}
    </span>
  )
}

export function ImpactPanel({
  projectId,
  selectedNode,
  allNodes,
  allEdges,
  onClose,
  onFocusNode,
}: ImpactPanelProps) {
  const { data: impact } = useImpactAnalysis(
    projectId,
    selectedNode ? [selectedNode.filePath] : [],
  )

  if (!selectedNode) return null

  // Direct imports: edges where this node is the source
  const imports = allEdges
    .filter((e) => e.source === selectedNode.id)
    .map((e) => allNodes.find((n) => n.id === e.target))
    .filter(Boolean) as GraphNode[]

  // Imported by: edges where this node is the target
  const importedBy = allEdges
    .filter((e) => e.target === selectedNode.id)
    .map((e) => allNodes.find((n) => n.id === e.source))
    .filter(Boolean) as GraphNode[]

  return (
    <aside className="w-72 bg-[#192030] border-l border-[#263245] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-[#263245]">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#dce8f5] truncate">{selectedNode.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <KindBadge kind={selectedNode.kind} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-[#607896] hover:text-[#dce8f5] transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* File */}
        <div>
          <p className="text-xs text-[#8299b8] mb-1">File</p>
          <div className="flex items-center gap-1.5">
            <FileCode size={12} className="text-[#607896]" />
            <span className="text-xs font-mono text-[#a8bdd4] break-all">
              {selectedNode.filePath}
              {selectedNode.lineNumber ? `:${selectedNode.lineNumber}` : ""}
            </span>
          </div>
        </div>

        {/* Imports */}
        {imports.length > 0 && (
          <div>
            <p className="text-xs text-[#8299b8] mb-1">Imports ({imports.length})</p>
            <ul className="space-y-1">
              {imports.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onFocusNode(n.id)}
                    className="flex items-center gap-1.5 text-xs text-[#a8bdd4] hover:text-[#4195e8] transition-colors"
                  >
                    <KindBadge kind={n.kind} />
                    <span className="truncate">{n.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Imported by */}
        {importedBy.length > 0 && (
          <div>
            <p className="text-xs text-[#8299b8] mb-1">Imported by ({importedBy.length})</p>
            <ul className="space-y-1">
              {importedBy.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onFocusNode(n.id)}
                    className="flex items-center gap-1.5 text-xs text-[#a8bdd4] hover:text-[#4195e8] transition-colors"
                  >
                    <KindBadge kind={n.kind} />
                    <span className="truncate">{n.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Blast radius */}
        <div>
          <p className="text-xs text-[#8299b8] mb-1">Blast Radius</p>
          {impact ? (
            <>
              <p className="text-xs text-[#a8bdd4] mb-2">
                {impact.affectedFiles.length} file{impact.affectedFiles.length !== 1 ? "s" : ""} affected
              </p>
              <ul className="space-y-0.5">
                {impact.affectedFiles.map((f) => (
                  <li key={f} className="text-xs font-mono text-[#607896] truncate">{f}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-[#607896]">Computing…</p>
          )}
        </div>
      </div>
    </aside>
  )
}
