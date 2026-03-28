"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase } from "@/lib/utils/camel-case"
import type { CommandInfo } from "@/lib/api/schemas/run"

/** Fetches slash commands available in the project's .claude/ directory. Cached for 30 seconds. */
export function useProjectCommands(projectId: string) {
  return useQuery<CommandInfo[]>({
    queryKey: ["project-commands", projectId],
    queryFn: async () => {
      const raw = await api.get<unknown[]>(`/api/projects/${projectId}/commands`)
      return toCamelCase<CommandInfo[]>(raw)
    },
    staleTime: 30_000,
    enabled: !!projectId,
  })
}
