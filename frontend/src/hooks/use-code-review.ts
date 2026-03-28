"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase, toSnakeCase } from "@/lib/utils/camel-case"
import type { GraphData, GraphStats, ImpactResult } from "@/lib/api/schemas/code-review"

export function useGraphStats(projectId: string) {
  return useQuery<GraphStats>({
    queryKey: ["graph-stats", projectId],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/projects/${projectId}/code-review/stats`)
      return toCamelCase<GraphStats>(raw)
    },
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })
}

export function useBuildGraph(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation<GraphStats, Error, { fullRebuild?: boolean }>({
    mutationFn: async (vars) => {
      const body = toSnakeCase<Record<string, unknown>>(vars)
      const raw = await api.post<unknown>(`/api/projects/${projectId}/code-review/build`, body)
      return toCamelCase<GraphStats>(raw)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graph-stats", projectId] })
      queryClient.invalidateQueries({ queryKey: ["graph-data", projectId] })
    },
  })
}

interface GraphDataParams {
  mode?: "full" | "focus" | "modified"
  targets?: string[]
  depth?: number
  kindFilter?: string[] | null
}

export function useGraphData(projectId: string, params: GraphDataParams = {}) {
  return useQuery<GraphData>({
    queryKey: ["graph-data", projectId, params],
    queryFn: async () => {
      const body = toSnakeCase<Record<string, unknown>>({
        mode: params.mode ?? "full",
        targets: params.targets ?? [],
        depth: params.depth ?? 2,
        kindFilter: params.kindFilter ?? null,
      })
      const raw = await api.post<unknown>(`/api/projects/${projectId}/code-review/graph-data`, body)
      return toCamelCase<GraphData>(raw)
    },
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  })
}

export function useImpactAnalysis(projectId: string, changedFiles: string[]) {
  return useQuery<ImpactResult>({
    queryKey: ["graph-impact", projectId, changedFiles],
    queryFn: async () => {
      const body = toSnakeCase<Record<string, unknown>>({ changedFiles, maxDepth: 3 })
      const raw = await api.post<unknown>(`/api/projects/${projectId}/code-review/impact`, body)
      return toCamelCase<ImpactResult>(raw)
    },
    enabled: Boolean(projectId) && changedFiles.length > 0,
    staleTime: 60_000,
    retry: false,
  })
}

export function useGraphNodes(projectId: string) {
  return useQuery<Array<{ id: string; name: string; kind: string; filePath: string }>>({
    queryKey: ["graph-nodes", projectId],
    queryFn: async () => {
      const raw = await api.get<unknown[]>(`/api/projects/${projectId}/code-review/nodes`)
      return toCamelCase<Array<{ id: string; name: string; kind: string; filePath: string }>>(raw)
    },
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  })
}
