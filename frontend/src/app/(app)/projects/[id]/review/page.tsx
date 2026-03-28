"use client"

import { use, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useBuildGraph, useGraphData, useGraphStats } from "@/hooks/use-code-review"
import { BuildGraphCTA } from "@/components/code-review/BuildGraphCTA"
import { GraphControls, type GraphMode } from "@/components/code-review/GraphControls"
import { DependencyGraph } from "@/components/code-review/DependencyGraph"
import { ImpactPanel } from "@/components/code-review/ImpactPanel"
import type { GraphNode } from "@/lib/api/schemas/code-review"

interface CodeReviewPageProps {
  params: Promise<{ id: string }>
}

export default function CodeReviewPage({ params }: CodeReviewPageProps) {
  const { id: projectId } = use(params)

  const [mode, setMode] = useState<GraphMode>("full")
  const [search, setSearch] = useState("")
  const [kindFilter, setKindFilter] = useState("")
  const [depth, setDepth] = useState(2)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [focusTargets, setFocusTargets] = useState<string[]>([])

  const { data: stats } = useGraphStats(projectId)
  const buildMutation = useBuildGraph(projectId)

  const graphQuery = useGraphData(projectId, {
    mode,
    targets: mode === "focus" ? focusTargets : [],
    depth,
    kindFilter: kindFilter ? [kindFilter] : null,
  })

  const graphData = graphQuery.data ?? { nodes: [], edges: [], warning: undefined }

  function handleModeChange(m: GraphMode) {
    setMode(m)
    setSelectedNode(null)
    if (m !== "focus") setFocusTargets([])
  }

  function handleFocusNode(nodeId: string) {
    setMode("focus")
    setFocusTargets([nodeId])
    setSelectedNode(graphData.nodes.find((n) => n.id === nodeId) ?? null)
  }

  const isBuilding = buildMutation.isPending
  const isBuilt = stats?.built

  return (
    <div className="flex flex-col h-screen bg-[#10161f]">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-6 py-3 border-b border-[#263245] bg-[#192030] flex-shrink-0">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-1.5 text-sm text-[#8299b8] hover:text-[#dce8f5] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Project
        </Link>
        <span className="text-[#263245]">/</span>
        <span className="text-sm font-semibold text-[#dce8f5]">Code Review</span>

        {stats && isBuilt && (
          <span className="ml-auto text-xs text-[#607896]">
            {stats.nodeCount} nodes · {stats.edgeCount} edges · {stats.fileCount} files
          </span>
        )}
      </header>

      {/* Not built state */}
      {!isBuilt && !isBuilding && (
        <div className="flex-1 flex items-center justify-center">
          <BuildGraphCTA projectId={projectId} />
        </div>
      )}

      {/* Building state */}
      {isBuilding && (
        <div className="flex-1 flex items-center justify-center">
          <BuildGraphCTA projectId={projectId} />
        </div>
      )}

      {/* Graph view */}
      {isBuilt && !isBuilding && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Controls */}
          <GraphControls
            projectId={projectId}
            mode={mode}
            onModeChange={handleModeChange}
            search={search}
            onSearchChange={setSearch}
            kindFilter={kindFilter}
            onKindFilterChange={setKindFilter}
            depth={depth}
            onDepthChange={setDepth}
          />

          {/* Graph + detail */}
          <div className="flex flex-1 overflow-hidden">
            {/* Graph canvas */}
            <div className="flex-1 relative overflow-hidden">
              {graphQuery.isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 rounded-full border-2 border-[#4195e8] border-t-transparent animate-spin" />
                </div>
              ) : graphQuery.isError ? (
                <div className="flex items-center justify-center h-full text-[#f25c5c] text-sm">
                  {graphQuery.error.message}
                </div>
              ) : (
                <DependencyGraph
                  graphData={graphData}
                  searchQuery={search}
                  selectedNodeId={selectedNode?.id ?? null}
                  onNodeSelect={setSelectedNode}
                />
              )}
            </div>

            {/* Impact / detail panel */}
            {selectedNode && (
              <ImpactPanel
                projectId={projectId}
                selectedNode={selectedNode}
                allNodes={graphData.nodes}
                allEdges={graphData.edges}
                onClose={() => setSelectedNode(null)}
                onFocusNode={handleFocusNode}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
