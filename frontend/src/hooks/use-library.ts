"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/lib/api/client"
import type {
  ImportRequestItem,
  ImportResult,
  LibraryFilters,
  LibraryItem,
  LibraryItemCreateRequest,
  LibraryItemSummary,
  LibraryItemUpdateRequest,
  ScanResponse,
} from "@/lib/api/schemas/library"
import { toCamelCase, toSnakeCase } from "@/lib/utils/camel-case"

// ---------------------------------------------------------------------------
// List / filter
// ---------------------------------------------------------------------------

export function useLibraryItems(filters: LibraryFilters = {}) {
  const params = new URLSearchParams()
  if (filters.type) params.set("type", filters.type)
  if (filters.source) params.set("source", filters.source)
  if (filters.tags?.length) params.set("tags", filters.tags.join(","))
  if (filters.q) params.set("q", filters.q)
  const qs = params.toString()

  return useQuery<LibraryItemSummary[]>({
    queryKey: ["library", filters],
    queryFn: async () => {
      const raw = await api.get<unknown[]>(`/api/library${qs ? `?${qs}` : ""}`)
      return toCamelCase<LibraryItemSummary[]>(raw)
    },
    staleTime: 10_000,
  })
}

// ---------------------------------------------------------------------------
// Single item
// ---------------------------------------------------------------------------

export function useLibraryItem(id: string | null) {
  return useQuery<LibraryItem>({
    queryKey: ["library", "item", id],
    queryFn: async () => {
      const raw = await api.get<unknown>(`/api/library/${id}`)
      return toCamelCase<LibraryItem>(raw)
    },
    enabled: Boolean(id),
  })
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export function useLibraryTags() {
  return useQuery<string[]>({
    queryKey: ["library", "tags"],
    queryFn: () => api.get<string[]>("/api/library/tags"),
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateLibraryItem() {
  const qc = useQueryClient()
  return useMutation<{ id: string }, Error, LibraryItemCreateRequest>({
    mutationFn: async (data) => {
      const body = toSnakeCase<Record<string, unknown>>(data as unknown as Record<string, unknown>)
      return api.post<{ id: string }>("/api/library", body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] })
    },
  })
}

export function useUpdateLibraryItem() {
  const qc = useQueryClient()
  return useMutation<LibraryItem, Error, { id: string; data: LibraryItemUpdateRequest }>({
    mutationFn: async ({ id, data }) => {
      const body = toSnakeCase<Record<string, unknown>>(data as unknown as Record<string, unknown>)
      const raw = await api.patch<unknown>(`/api/library/${id}`, body)
      return toCamelCase<LibraryItem>(raw)
    },
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: ["library"] })
      qc.invalidateQueries({ queryKey: ["library", "item", vars.id] })
    },
  })
}

export function useDeleteLibraryItem() {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => api.delete<{ ok: boolean }>(`/api/library/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] })
    },
  })
}

export function useCopyToProject() {
  return useMutation<{ ok: boolean; copiedTo: string }, Error, { itemId: string; projectId: string }>({
    mutationFn: async ({ itemId, projectId }) => {
      const raw = await api.post<unknown>(`/api/library/${itemId}/copy-to-project`, {
        project_id: projectId,
      })
      return toCamelCase<{ ok: boolean; copiedTo: string }>(raw)
    },
  })
}

// ---------------------------------------------------------------------------
// Import wizard
// ---------------------------------------------------------------------------

export function useScanClaude() {
  return useMutation<ScanResponse, Error, string>({
    mutationFn: async (path) => {
      const raw = await api.post<unknown>("/api/library/claude-import/scan", { path })
      return toCamelCase<ScanResponse>(raw)
    },
  })
}

export function useImportItems() {
  const qc = useQueryClient()
  return useMutation<ImportResult, Error, { scanRoot: string; items: ImportRequestItem[] }>({
    mutationFn: async ({ scanRoot, items }) => {
      const body = toSnakeCase<Record<string, unknown>>({
        scanRoot,
        items: items.map((i) => ({ sourcePath: i.sourcePath, overwrite: i.overwrite })),
      } as unknown as Record<string, unknown>)
      const raw = await api.post<unknown>("/api/library/claude-import/import", body)
      return toCamelCase<ImportResult>(raw)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library"] })
    },
  })
}
