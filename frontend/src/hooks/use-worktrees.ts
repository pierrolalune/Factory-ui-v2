"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase, toSnakeCase } from "@/lib/utils/camel-case"
import type { Worktree } from "@/lib/api/schemas/git"

// Poll worktrees every 10 seconds
export function useWorktrees(projectId: string) {
  return useQuery<Worktree[]>({
    queryKey: ["worktrees", projectId],
    queryFn: async () => {
      const raw = await api.get<unknown[]>(`/api/projects/${projectId}/worktrees`)
      return toCamelCase<Worktree[]>(raw)
    },
    enabled: Boolean(projectId),
    refetchInterval: 10_000,
  })
}

export function useBranches(projectId: string) {
  return useQuery<{ current: string; local: string[]; remote: string[] }>({
    queryKey: ["branches", projectId],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/projects/${projectId}/worktrees/branches/list`)
      return toCamelCase<{ current: string; local: string[]; remote: string[] }>(raw)
    },
    enabled: Boolean(projectId),
  })
}

export function useCreateWorktree(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation<
    { id: string; path: string },
    Error,
    { branch: string; baseBranch: string; createBranch: boolean }
  >({
    mutationFn: async (data) => {
      const body = toSnakeCase<Record<string, unknown>>(data as unknown as Record<string, unknown>)
      return api.post<{ id: string; path: string }>(
        `/api/projects/${projectId}/worktrees`,
        body,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worktrees", projectId] })
    },
  })
}

export function useDeleteWorktree(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation<
    { ok: boolean },
    Error,
    { worktreeId: string; deleteBranch?: boolean }
  >({
    mutationFn: async ({ worktreeId, deleteBranch = false }) => {
      return api.delete<{ ok: boolean }>(
        `/api/projects/${projectId}/worktrees/${worktreeId}?delete_branch=${deleteBranch}`,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worktrees", projectId] })
    },
  })
}
