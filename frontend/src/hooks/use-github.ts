"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase, toSnakeCase } from "@/lib/utils/camel-case"
import type { PullRequest, PushResult, RemoteInfo } from "@/lib/api/schemas/github"

/** Fetch the GitHub remote info (owner/repo/default branch) for a project. */
export function useRemoteInfo(projectId: string) {
  return useQuery<RemoteInfo>({
    queryKey: ["github-remote", projectId],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/projects/${projectId}/github/remote`)
      return toCamelCase<RemoteInfo>(raw)
    },
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false, // don't retry if project has no GitHub remote
  })
}

/** Push a branch to GitHub origin. */
export function usePushBranch(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation<
    PushResult,
    Error,
    { branch: string; worktreePath?: string; force?: boolean }
  >({
    mutationFn: async (vars) => {
      const body = toSnakeCase<Record<string, unknown>>(vars)
      const raw = await api.post<unknown>(`/api/projects/${projectId}/github/push`, body)
      return toCamelCase<PushResult>(raw)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-prs", projectId] })
    },
  })
}

/** Create a GitHub pull request. */
export function useCreatePR(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation<
    PullRequest,
    Error,
    { headBranch: string; baseBranch: string; title: string; body?: string }
  >({
    mutationFn: async (vars) => {
      const body = toSnakeCase<Record<string, unknown>>(vars)
      const raw = await api.post<unknown>(`/api/projects/${projectId}/github/pull-request`, body)
      return toCamelCase<PullRequest>(raw)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github-prs", projectId] })
    },
  })
}

/** List open pull requests for a project. */
export function useListPRs(projectId: string, branch?: string) {
  const params = branch ? `?branch=${encodeURIComponent(branch)}` : ""
  return useQuery<PullRequest[]>({
    queryKey: ["github-prs", projectId, branch],
    queryFn: async () => {
      const raw = await api.get<unknown[]>(
        `/api/projects/${projectId}/github/pull-requests${params}`,
      )
      return toCamelCase<PullRequest[]>(raw)
    },
    enabled: Boolean(projectId),
    staleTime: 30_000,
    retry: false,
  })
}
