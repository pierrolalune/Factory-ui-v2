"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase, toSnakeCase } from "@/lib/utils/camel-case"
import type { GitCommit, GitDiff, GitStatus } from "@/lib/api/schemas/git"

// Poll git status every 5 seconds
export function useGitStatus(projectId: string, worktreePath?: string) {
  const params = new URLSearchParams()
  if (worktreePath) params.set("worktree_path", worktreePath)
  const qs = params.toString() ? `?${params.toString()}` : ""

  return useQuery<GitStatus>({
    queryKey: ["git-status", projectId, worktreePath],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/projects/${projectId}/git/status${qs}`)
      return toCamelCase<GitStatus>(raw)
    },
    enabled: Boolean(projectId),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  })
}

// Lazy — only runs when filePath is provided
export function useGitDiff(
  projectId: string,
  filePath: string | null,
  staged: boolean,
  worktreePath?: string,
) {
  const params = new URLSearchParams()
  if (filePath) params.set("path", filePath)
  params.set("staged", String(staged))
  if (worktreePath) params.set("worktree_path", worktreePath)

  return useQuery<GitDiff>({
    queryKey: ["git-diff", projectId, filePath, staged, worktreePath],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/projects/${projectId}/git/diff?${params.toString()}`)
      return toCamelCase<GitDiff>(raw)
    },
    enabled: Boolean(projectId) && Boolean(filePath),
    staleTime: 10_000,
  })
}

export function useGitLog(projectId: string, worktreePath?: string) {
  const params = new URLSearchParams()
  if (worktreePath) params.set("worktree_path", worktreePath)
  const qs = params.toString() ? `?${params.toString()}` : ""

  return useQuery<GitCommit[]>({
    queryKey: ["git-log", projectId, worktreePath],
    queryFn: async () => {
      const raw = await api.get<unknown[]>(`/api/projects/${projectId}/git/log${qs}`)
      return toCamelCase<GitCommit[]>(raw)
    },
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
  })
}

export function useStageFiles(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean }, Error, { paths: string[]; worktreePath?: string }>({
    mutationFn: async ({ paths, worktreePath }) => {
      const body = toSnakeCase<Record<string, unknown>>({ paths, worktreePath })
      return api.post<{ ok: boolean }>(`/api/projects/${projectId}/git/stage`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["git-status", projectId] })
    },
  })
}

export function useUnstageFiles(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean }, Error, { paths: string[]; worktreePath?: string }>({
    mutationFn: async ({ paths, worktreePath }) => {
      const body = toSnakeCase<Record<string, unknown>>({ paths, worktreePath })
      return api.post<{ ok: boolean }>(`/api/projects/${projectId}/git/unstage`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["git-status", projectId] })
    },
  })
}

export function useDiscardChanges(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation<{ ok: boolean }, Error, { paths: string[]; worktreePath?: string }>({
    mutationFn: async ({ paths, worktreePath }) => {
      const body = toSnakeCase<Record<string, unknown>>({ paths, worktreePath })
      return api.post<{ ok: boolean }>(`/api/projects/${projectId}/git/discard`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["git-status", projectId] })
    },
  })
}

export function useCommit(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation<
    { hash: string; message: string },
    Error,
    { message: string; worktreePath?: string }
  >({
    mutationFn: async ({ message, worktreePath }) => {
      const body = toSnakeCase<Record<string, unknown>>({ message, worktreePath })
      return api.post<{ hash: string; message: string }>(
        `/api/projects/${projectId}/git/commit`,
        body,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["git-status", projectId] })
      queryClient.invalidateQueries({ queryKey: ["git-log", projectId] })
    },
  })
}
