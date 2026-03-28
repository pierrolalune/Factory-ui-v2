"use client"

import { Zap } from "lucide-react"

/** Amber pulsing badge shown when a run is waiting for user input. */
export function AwaitingInputBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
        text-[10px] font-medium uppercase tracking-wider
        text-[#f59e0b] border border-[#f59e0b]/20 animate-pulse"
      aria-live="polite"
      aria-label="Waiting for input"
    >
      <Zap size={10} />
      Waiting for input
    </span>
  )
}
