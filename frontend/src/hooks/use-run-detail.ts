"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase } from "@/lib/utils/camel-case"
import type { Run } from "@/lib/api/schemas/run"

/** Fetch the full Run detail for a specific run ID. */
export function useRunDetail(runId: string) {
  return useQuery<Run>({
    queryKey: ["run-detail", runId],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/runs/${runId}`)
      return toCamelCase<Run>(raw)
    },
    enabled: Boolean(runId),
    staleTime: 10_000,
  })
}

/** Fetch the stored PTY output for a completed run (base64-encoded bytes). */
export function useRunOutput(runId: string, enabled = true) {
  return useQuery<string>({
    queryKey: ["run-output", runId],
    queryFn: async () => {
      const resp = await api.get<{ data: string }>(`/api/runs/${runId}/output`)
      return resp.data
    },
    enabled: Boolean(runId) && enabled,
    staleTime: Infinity, // output never changes once run ends
  })
}

/** Delete a run record and its output. */
export function useDeleteRun() {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: async (runId) => api.delete<{ ok: boolean }>(`/api/runs/${runId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] })
    },
  })
}
