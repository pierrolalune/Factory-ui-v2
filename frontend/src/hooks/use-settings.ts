"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase, toSnakeCase } from "@/lib/utils/camel-case"
import type { Settings } from "@/lib/api/schemas/settings"

const SETTINGS_KEY = ["settings"]

export function useSettings() {
  return useQuery<Settings>({
    queryKey: SETTINGS_KEY,
    queryFn: async () => {
      const raw = await api.get<unknown>("/api/settings")
      return toCamelCase<Settings>(raw)
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      const body = toSnakeCase(data)
      const raw = await api.patch<unknown>("/api/settings", body)
      return toCamelCase<Settings>(raw)
    },
    onSuccess: (updated) => {
      qc.setQueryData(SETTINGS_KEY, updated)
    },
  })
}

export function useSaveGitHubToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (token: string) => {
      const raw = await api.post<{ username: string; valid: boolean }>("/api/settings/github/token", {
        token,
      })
      return raw
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETTINGS_KEY })
    },
  })
}

export function useRemoveGitHubToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return api.delete<{ ok: boolean }>("/api/settings/github/token")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETTINGS_KEY })
    },
  })
}
