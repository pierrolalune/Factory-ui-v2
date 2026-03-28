"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase } from "@/lib/utils/camel-case"
import { toSnakeCase } from "@/lib/utils/camel-case"
import type {
  LaunchCommandRequest,
  LaunchRunResponse,
  LaunchRawRequest,
  ResumeRunRequest,
} from "@/lib/api/schemas/run"

/** POST /api/run/command — launch a slash command that exists in the project's .claude/ */
export function useLaunchCommand() {
  const queryClient = useQueryClient()
  return useMutation<LaunchRunResponse, Error, LaunchCommandRequest>({
    mutationFn: async (req) => {
      const body = toSnakeCase(req)
      const raw = await api.post<unknown>("/api/run/command", body)
      return toCamelCase<LaunchRunResponse>(raw)
    },
    onSuccess: () => {
      // Invalidate run queries so Run Navigator updates
      queryClient.invalidateQueries({ queryKey: ["runs"] })
    },
  })
}

/** POST /api/run/raw — open an interactive Claude session */
export function useLaunchRaw() {
  const queryClient = useQueryClient()
  return useMutation<LaunchRunResponse, Error, LaunchRawRequest>({
    mutationFn: async (req) => {
      const body = toSnakeCase(req)
      const raw = await api.post<unknown>("/api/run/raw", body)
      return toCamelCase<LaunchRunResponse>(raw)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] })
    },
  })
}

/** POST /api/run/resume — resume a past Claude session */
export function useResumeRun() {
  const queryClient = useQueryClient()
  return useMutation<LaunchRunResponse, Error, ResumeRunRequest>({
    mutationFn: async (req) => {
      const body = toSnakeCase(req)
      const raw = await api.post<unknown>("/api/run/resume", body)
      return toCamelCase<LaunchRunResponse>(raw)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] })
    },
  })
}

/** POST /api/run/{id}/cancel — cancel an active run */
export function useCancelRun() {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: async (runId) => {
      return api.post<{ ok: boolean }>(`/api/run/${runId}/cancel`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] })
    },
  })
}
