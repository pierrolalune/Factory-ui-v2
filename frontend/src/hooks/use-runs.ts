"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase } from "@/lib/utils/camel-case"
import type { RunSummary } from "@/lib/api/schemas/run"

interface UseRunsOptions {
  projectId?: string
  status?: string
  limit?: number
  sort?: string
}

function buildRunsUrl(opts: UseRunsOptions): string {
  const params = new URLSearchParams()
  if (opts.projectId) params.set("project_id", opts.projectId)
  if (opts.status) params.set("status", opts.status)
  if (opts.limit != null) params.set("limit", String(opts.limit))
  if (opts.sort) params.set("sort", opts.sort)
  const qs = params.toString()
  return `/api/runs${qs ? `?${qs}` : ""}`
}

/** Polls active + awaiting_input runs every 2 seconds for live cockpit/IDE updates. */
export function useActiveRuns(projectId?: string) {
  return useQuery<RunSummary[]>({
    queryKey: ["runs", "active", projectId],
    queryFn: async () => {
      const raw = await api.get<unknown[]>(buildRunsUrl({ status: "active", projectId }))
      return toCamelCase<RunSummary[]>(raw)
    },
    refetchInterval: 2_000,
  })
}

/** Polls recent runs every 5 seconds for cockpit and project overview. */
export function useRecentRuns(limit = 10, projectId?: string) {
  return useQuery<RunSummary[]>({
    queryKey: ["runs", "recent", limit, projectId],
    queryFn: async () => {
      const raw = await api.get<unknown[]>(
        buildRunsUrl({ limit, sort: "started_at_desc", projectId }),
      )
      return toCamelCase<RunSummary[]>(raw)
    },
    refetchInterval: 5_000,
  })
}

/** Generic runs hook with full filter control. */
export function useRuns(opts: UseRunsOptions = {}) {
  return useQuery<RunSummary[]>({
    queryKey: ["runs", opts],
    queryFn: async () => {
      const raw = await api.get<unknown[]>(buildRunsUrl(opts))
      return toCamelCase<RunSummary[]>(raw)
    },
  })
}
