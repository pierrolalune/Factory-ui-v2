import { z } from "zod/v4"

export const GraphNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["function", "class", "type", "module", "variable", "export"]),
  filePath: z.string(),
  lineNumber: z.number().optional(),
})

export const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum(["import", "call", "extends", "implements"]),
})

export const GraphDataSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  warning: z.string().optional(),
})

export const GraphStatsSchema = z.object({
  built: z.boolean(),
  nodeCount: z.number(),
  edgeCount: z.number(),
  fileCount: z.number(),
  lastBuiltAt: z.string().optional(),
})

export const ImpactResultSchema = z.object({
  changedFiles: z.array(z.string()),
  affectedNodes: z.array(GraphNodeSchema),
  affectedFiles: z.array(z.string()),
  depth: z.number(),
})

export type GraphNode = z.infer<typeof GraphNodeSchema>
export type GraphEdge = z.infer<typeof GraphEdgeSchema>
export type GraphData = z.infer<typeof GraphDataSchema>
export type GraphStats = z.infer<typeof GraphStatsSchema>
export type ImpactResult = z.infer<typeof ImpactResultSchema>
