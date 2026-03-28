"use client"

import { useCallback, useEffect, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dagre = require("dagre") as typeof import("dagre")
import type { GraphData, GraphNode } from "@/lib/api/schemas/code-review"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

const KIND_COLORS: Record<string, string> = {
  function: "#4195e8",
  class: "#8b5cf6",
  type: "#14b8a6",
  module: "#6b7280",
  variable: "#f59e0b",
  export: "#22c55e",
}

// ---------------------------------------------------------------------------
// Layout via dagre
// ---------------------------------------------------------------------------

function layoutNodes(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  const laid = nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    }
  })

  return { nodes: laid, edges }
}

// ---------------------------------------------------------------------------
// Custom node component
// ---------------------------------------------------------------------------

interface CustomNodeData {
  label: string
  kind: string
  filePath: string
  selected?: boolean
  highlighted?: boolean
  [key: string]: unknown
}

function GraphNodeComponent({ data }: { data: CustomNodeData }) {
  const color = KIND_COLORS[data.kind] ?? "#607896"
  return (
    <div
      className="rounded-lg px-3 py-2 text-center"
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        border: `1px solid ${color}`,
        background: `${color}20`,
        opacity: data.highlighted === false ? 0.4 : 1,
      }}
    >
      <p
        className="text-xs font-semibold truncate"
        style={{ color, maxWidth: NODE_WIDTH - 24 }}
        title={data.label}
      >
        {data.label}
      </p>
      <span
        className="inline-block mt-0.5 px-1 py-0.5 rounded text-[9px] font-medium"
        style={{ color, backgroundColor: `${color}30` }}
      >
        {data.kind}
      </span>
      <p className="text-[9px] text-[#607896] truncate mt-0.5" title={data.filePath}>
        {data.filePath}
      </p>
    </div>
  )
}

const nodeTypes = { custom: GraphNodeComponent }

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DependencyGraphProps {
  graphData: GraphData
  searchQuery: string
  selectedNodeId: string | null
  onNodeSelect: (node: GraphNode | null) => void
}

export function DependencyGraph({
  graphData,
  searchQuery,
  selectedNodeId,
  onNodeSelect,
}: DependencyGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Build ReactFlow nodes from graph data
  const rfNodes: Node[] = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return graphData.nodes.map((n) => {
      const highlighted = !q || n.name.toLowerCase().includes(q) || n.filePath.toLowerCase().includes(q)
      return {
        id: n.id,
        type: "custom",
        position: { x: 0, y: 0 },
        data: {
          label: n.name,
          kind: n.kind,
          filePath: n.filePath,
          highlighted: !q || highlighted,
        },
        selected: n.id === selectedNodeId,
      }
    })
  }, [graphData.nodes, searchQuery, selectedNodeId])

  // Build ReactFlow edges
  const rfEdges: Edge[] = useMemo(
    () =>
      graphData.edges.map((e, i) => ({
        id: `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        style: {
          stroke:
            e.source === selectedNodeId || e.target === selectedNodeId ? "#4195e8" : "#263245",
          strokeWidth: e.source === selectedNodeId || e.target === selectedNodeId ? 2 : 1,
        },
        animated: e.source === selectedNodeId || e.target === selectedNodeId,
      })),
    [graphData.edges, selectedNodeId],
  )

  // Apply dagre layout when graph data changes
  useEffect(() => {
    if (rfNodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }
    const { nodes: laid, edges: laidEdges } = layoutNodes(rfNodes, rfEdges)
    setNodes(laid)
    setEdges(laidEdges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const found = graphData.nodes.find((n) => n.id === node.id) ?? null
      onNodeSelect(found)
    },
    [graphData.nodes, onNodeSelect],
  )

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null)
  }, [onNodeSelect])

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#607896] text-sm">
        No nodes to display.
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      {graphData.warning && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg
          bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-xs text-[#f59e0b]">
          {graphData.warning}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#263245" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => KIND_COLORS[(n.data as CustomNodeData).kind] ?? "#607896"}
          style={{ backgroundColor: "#10161f", border: "1px solid #263245" }}
        />
      </ReactFlow>
    </div>
  )
}
