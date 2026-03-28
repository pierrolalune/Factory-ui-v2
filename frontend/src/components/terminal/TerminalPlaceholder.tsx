"use client"

import { Terminal } from "lucide-react"

interface TerminalPlaceholderProps {
  runId: string
  onClose: () => void
}

export function TerminalPlaceholder({ runId, onClose }: TerminalPlaceholderProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#263245] bg-[#192030] shrink-0">
        <Terminal size={14} className="text-[#8299b8]" />
        <span className="text-sm font-mono text-[#dce8f5]">{runId}</span>
        <button
          onClick={onClose}
          className="ml-auto text-xs text-[#8299b8] hover:text-[#dce8f5] transition-colors px-2 py-1 rounded"
          aria-label="Close terminal"
        >
          ✕
        </button>
      </div>

      {/* Placeholder body */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
        <Terminal size={32} className="text-[#263245]" />
        <p className="text-sm font-medium text-[#8299b8]">Terminal view coming in Sprint 3</p>
        <p className="text-xs text-[#607896] max-w-xs">
          Terminal view will be available after Sprint 3 (Run Execution). Full PTY output, live
          streaming, and interactive input will work once the run infrastructure is in place.
        </p>
      </div>
    </div>
  )
}
