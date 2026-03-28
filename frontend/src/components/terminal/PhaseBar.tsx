"use client"

import { AwaitingInputBadge } from "./AwaitingInputBadge"
import type { WsPhaseUpdate } from "@/lib/api/schemas/run"

interface PhaseBarProps {
  phase: WsPhaseUpdate | null
  awaitingInput: boolean
}

/** Shows the current Claude phase (thinking, tool use, text) or awaiting-input state. */
export function PhaseBar({ phase, awaitingInput }: PhaseBarProps) {
  if (awaitingInput) {
    return (
      <div className="px-4 py-1.5 bg-[#192030] border-b border-[#263245] flex items-center gap-2 shrink-0">
        <AwaitingInputBadge />
      </div>
    )
  }

  if (!phase || phase.phase === "idle") {
    return (
      <div className="px-4 py-1.5 bg-[#192030] border-b border-[#263245] shrink-0 h-8" />
    )
  }

  return (
    <div className="px-4 py-1.5 bg-[#192030] border-b border-[#263245] flex items-center gap-2 shrink-0">
      {phase.phase === "thinking" && (
        <span className="text-xs text-[#8299b8] font-mono">Thinking…</span>
      )}
      {phase.phase === "text" && (
        <span className="text-xs text-[#8299b8] font-mono">Writing response…</span>
      )}
      {phase.phase === "tool_use" && (
        <span className="text-xs text-[#8299b8] font-mono truncate">
          <span className="text-[#4195e8]">{phase.toolName ?? "Tool"}</span>
          {phase.filePath && (
            <span className="text-[#607896]"> — {phase.filePath}</span>
          )}
        </span>
      )}
    </div>
  )
}
