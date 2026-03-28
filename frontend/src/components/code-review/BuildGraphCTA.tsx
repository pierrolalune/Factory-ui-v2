"use client"

import { Loader2, Network } from "lucide-react"
import { useBuildGraph, useGraphStats } from "@/hooks/use-code-review"

interface BuildGraphCTAProps {
  projectId: string
}

export function BuildGraphCTA({ projectId }: BuildGraphCTAProps) {
  const { data: stats } = useGraphStats(projectId)
  const buildMutation = useBuildGraph(projectId)

  if (buildMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <Loader2 size={32} className="text-[#4195e8] animate-spin" />
        <p className="text-sm text-[#8299b8]">Building dependency graph…</p>
        <p className="text-xs text-[#607896]">This may take up to 30 seconds for large projects.</p>
      </div>
    )
  }

  if (stats?.built) return null

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center max-w-md mx-auto">
      <Network size={48} className="text-[#263245]" />
      <div>
        <h3 className="text-base font-semibold text-[#dce8f5] mb-2">
          Dependency graph not built yet
        </h3>
        <p className="text-sm text-[#8299b8]">
          Building the graph analyses your codebase&apos;s imports and dependencies to create a
          navigable map. This usually takes 5–30 seconds.
        </p>
      </div>
      <button
        onClick={() => buildMutation.mutate({})}
        className="px-6 py-2.5 rounded-lg bg-[#4195e8] text-white text-sm font-medium
          hover:bg-[#5aabf5] transition-colors"
      >
        Build Graph
      </button>
      {buildMutation.isError && (
        <p className="text-xs text-[#f25c5c]">{buildMutation.error.message}</p>
      )}
    </div>
  )
}
