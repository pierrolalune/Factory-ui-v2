"use client"

import { useState } from "react"
import { Play, Terminal } from "lucide-react"

export function LaunchTab() {
  const [command, setCommand] = useState("")
  const [skipPermissions, setSkipPermissions] = useState(false)
  const [effort, setEffort] = useState("auto")

  // Command must start with "/" to be valid
  const isValid = command.trim().startsWith("/") && command.trim().length > 1

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-[#dce8f5]">Launch</h3>

      {/* Command input */}
      <div>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="/ for commands"
          className="w-full border border-[#263245] bg-[#1f2a3e] text-[#dce8f5]
            placeholder:text-[#607896] focus:ring-2 focus:ring-[#4195e8] focus:border-[#4195e8]
            rounded-lg px-3 py-2 text-sm outline-none transition-colors font-mono"
        />
        <p className="mt-1 text-xs text-[#607896]">Commands must start with /</p>
      </div>

      {/* Worktree selector */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#8299b8] mb-1">Worktree</label>
          <select
            className="w-full border border-[#263245] bg-[#1f2a3e] text-[#dce8f5]
              rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4195e8]"
            defaultValue="main"
          >
            <option value="main">main</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[#8299b8] mb-1">Effort</label>
          <select
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            className="w-full border border-[#263245] bg-[#1f2a3e] text-[#dce8f5]
              rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#4195e8]"
          >
            <option value="auto">auto</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="max">max</option>
          </select>
        </div>
      </div>

      {/* Skip permissions */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={skipPermissions}
          onChange={(e) => setSkipPermissions(e.target.checked)}
          className="w-4 h-4 rounded border-[#263245] bg-[#1f2a3e] accent-[#4195e8]"
        />
        <span className="text-xs text-[#a8bdd4]">Skip permissions</span>
      </label>

      {/* Run button */}
      <button
        disabled={!isValid}
        className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
          bg-[#4195e8] text-white hover:bg-[#5aabf5] transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Run command"
      >
        <Play size={14} />
        Run
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#263245]" />
        <span className="text-xs text-[#607896]">OR</span>
        <div className="flex-1 h-px bg-[#263245]" />
      </div>

      {/* Raw Claude Terminal button */}
      <button
        disabled
        className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
          border border-[#263245] text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Open Raw Claude Terminal"
      >
        <Terminal size={14} />
        Open Raw Claude Terminal
      </button>
      <p className="text-xs text-[#607896] text-center">Available in Sprint 3</p>
    </div>
  )
}
