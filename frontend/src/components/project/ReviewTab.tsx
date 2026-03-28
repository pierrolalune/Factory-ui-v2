"use client"

import Link from "next/link"
import { Network, ArrowRight } from "lucide-react"

interface ReviewTabProps {
  projectId: string
}

export function ReviewTab({ projectId }: ReviewTabProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-[#dce8f5] flex items-center gap-2 mb-4">
        <Network size={16} className="text-[#4195e8]" />
        Code Review
      </h3>
      <div className="border border-[#263245] bg-[#1f2a3e] rounded-lg p-4 space-y-3">
        <p className="text-sm text-[#a8bdd4]">
          Understand your project&apos;s dependency structure and the blast radius of any file change.
        </p>
        <Link
          href={`/projects/${projectId}/review`}
          className="inline-flex items-center gap-2 rounded-lg bg-[#4195e8] px-4 py-2 text-sm font-medium text-white
            hover:bg-[#5aabf5] transition-colors"
        >
          Open Dependency Graph
          <ArrowRight size={14} />
        </Link>
        <p className="text-xs text-[#607896]">Full ReactFlow graph coming in Sprint 8.</p>
      </div>
    </div>
  )
}
