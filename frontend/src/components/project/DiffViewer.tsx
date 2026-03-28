"use client"

import type { DiffHunk as DiffHunkType, GitDiff } from "@/lib/api/schemas/git"

interface DiffViewerProps {
  diff: GitDiff
}

function DiffHunkBlock({ hunk }: { hunk: DiffHunkType }) {
  return (
    <div className="font-mono text-xs">
      {/* Hunk header */}
      <div className="px-3 py-0.5 text-[#607896] bg-[#10161f] select-none">{hunk.header}</div>
      {hunk.lines.map((line, i) => {
        const isAdd = line.type === "add"
        const isRemove = line.type === "remove"
        return (
          <div
            key={i}
            className={`flex gap-0 ${
              isAdd
                ? "bg-green-900/20"
                : isRemove
                  ? "bg-red-900/20"
                  : ""
            }`}
          >
            {/* Old line number */}
            <span className="w-10 shrink-0 text-right pr-2 text-[#607896] select-none border-r border-[#263245]">
              {line.oldLineNo ?? ""}
            </span>
            {/* New line number */}
            <span className="w-10 shrink-0 text-right pr-2 text-[#607896] select-none border-r border-[#263245]">
              {line.newLineNo ?? ""}
            </span>
            {/* Sign */}
            <span
              className={`w-5 shrink-0 pl-1 select-none ${
                isAdd ? "text-[#22c55e]" : isRemove ? "text-[#f25c5c]" : "text-[#8299b8]"
              }`}
            >
              {isAdd ? "+" : isRemove ? "-" : " "}
            </span>
            {/* Content */}
            <span
              className={`flex-1 px-1 whitespace-pre ${
                isAdd ? "text-[#22c55e]" : isRemove ? "text-[#f25c5c]" : "text-[#8299b8]"
              }`}
            >
              {line.content}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function DiffViewer({ diff }: DiffViewerProps) {
  if (diff.isBinary) {
    return (
      <div className="p-4 text-sm text-[#607896] italic text-center">
        Binary file — cannot display diff
      </div>
    )
  }

  if (diff.hunks.length === 0) {
    return (
      <div className="p-4 text-sm text-[#607896] italic text-center">
        No changes to display
      </div>
    )
  }

  return (
    <div
      className="overflow-auto max-h-[400px] text-xs font-mono bg-[#10161f] border border-[#263245] rounded-lg"
      style={{ fontFamily: "DM Mono, monospace" }}
    >
      {diff.hunks.map((hunk, i) => (
        <DiffHunkBlock key={i} hunk={hunk} />
      ))}
    </div>
  )
}
