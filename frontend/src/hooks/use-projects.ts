"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase, toSnakeCase } from "@/lib/utils/camel-case"
import type {
  ProjectSummary,
  PathInfo,
  BrowseResponse,
  DiscoverResponse,
  CreateProjectRequest,
  CreateProjectResponse,
} from "@/lib/api/schemas/project"

export function useProjects() {
  return useQuery<ProjectSummary[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const raw = await api.get<unknown[]>("/api/projects")
      return toCamelCase<ProjectSummary[]>(raw)
    },
    refetchInterval: 10_000,
  })
}

export function useProject(id: string) {
  return useQuery<ProjectSummary>({
    queryKey: ["projects", id],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/projects/${id}`)
      return toCamelCase<ProjectSummary>(raw)
    },
    enabled: Boolean(id),
  })
}

// Lazy path validation — only runs when path is non-empty and enabled=true
export function useValidatePath(path: string, enabled: boolean) {
  return useQuery<PathInfo>({
    queryKey: ["validate-path", path],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/projects/validate-path?path=${encodeURIComponent(path)}`)
      return toCamelCase<PathInfo>(raw)
    },
    enabled: Boolean(path) && enabled,
    retry: false,
    // Stale immediately so re-blur always re-fetches
    staleTime: 0,
  })
}

// Browse a filesystem directory — refetches when path changes
export function useBrowseDirectory(path: string, enabled: boolean) {
  return useQuery<BrowseResponse>({
    queryKey: ["browse", path],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/system/browse?path=${encodeURIComponent(path)}`)
      return toCamelCase<BrowseResponse>(raw)
    },
    enabled: Boolean(path) && enabled,
    retry: false,
  })
}

// Discover project candidates under a base path — lazy, triggered manually
export function useDiscoverProjects(basePath: string, enabled: boolean) {
  return useQuery<DiscoverResponse>({
    queryKey: ["discover-projects", basePath],
    queryFn: async () => {
      const raw = await api.get<unknown>(
        `/api/system/discover-projects?base_path=${encodeURIComponent(basePath)}`,
      )
      return toCamelCase<DiscoverResponse>(raw)
    },
    enabled: Boolean(basePath) && enabled,
    retry: false,
    // Keep cached for 30s — discovery is slow, avoid redundant scans
    staleTime: 30_000,
  })
}

// Create a new project
export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation<CreateProjectResponse, Error, CreateProjectRequest>({
    mutationFn: async (data) => {
      const body = toSnakeCase<Record<string, unknown>>(data as unknown as Record<string, unknown>)
      const raw = await api.post<unknown>("/api/projects", body)
      return toCamelCase<CreateProjectResponse>(raw)
    },
    onSuccess: () => {
      // Invalidate project list so the new project shows up immediately
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}
