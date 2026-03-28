"use client"

import { GitBranch } from "lucide-react"

export function BranchesTab() {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-[#dce8f5] flex items-center gap-2 mb-4">
        <GitBranch size={16} className="text-[#4195e8]" />
        Branches
      </h3>
      <div className="border border-[#263245] bg-[#1f2a3e] rounded-lg p-4 text-center">
        <GitBranch size={24} className="text-[#263245] mx-auto mb-2" />
        <p className="text-sm text-[#8299b8]">Worktree management coming in Sprint 5</p>
        <p className="mt-1 text-xs text-[#607896]">
          Create, merge, and delete worktrees for parallel Claude runs.
        </p>
      </div>
    </div>
  )
}
