"use client"

import { useState, useCallback, useRef } from "react"
import { Play, Terminal, RotateCcw, X, Check, Ban } from "lucide-react"
import { useIDEStore } from "@/store/ide-store"
import { useToastStore } from "@/store/toast-store"
import { useProjectCommands } from "@/hooks/use-project-commands"
import { useLaunchCommand, useLaunchRaw, useResumeRun } from "@/hooks/use-run-actions"
import { useRecentRuns } from "@/hooks/use-runs"
import { CommandInput } from "./CommandInput"
import { CommandAutocomplete } from "./CommandAutocomplete"

interface LaunchTabProps {
  projectId: string
}

type EffortLevel = "auto" | "low" | "medium" | "high" | "max"

function formatDuration(secs: number | undefined): string {
  if (!secs) return ""
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function RecentRunStatus({ status }: { status: string }) {
  if (status === "completed") return <Check size={10} className="text-[#22c55e]" />
  if (status === "failed") return <X size={10} className="text-[#f25c5c]" />
  if (status === "cancelled") return <Ban size={10} className="text-[#607896]" />
  return null
}

/** Full Launch tab: command input, autocomplete, worktree/effort selectors, run button, recent runs. */
export function LaunchTab({ projectId }: LaunchTabProps) {
  const { focusRun } = useIDEStore()
  const { addToast } = useToastStore()

  const [command, setCommand] = useState("")
  const [skipPermissions, setSkipPermissions] = useState(false)
  const [effort, setEffort] = useState<EffortLevel>("auto")
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  const inputContainerRef = useRef<HTMLDivElement | null>(null)

  const { data: projectCommands = [] } = useProjectCommands(projectId)
  const launchCommand = useLaunchCommand()
  const launchRaw = useLaunchRaw()
  const resumeRun = useResumeRun()

  const { data: recentRuns = [] } = useRecentRuns(5, projectId)

  // Command is valid if it starts with "/" and has at least a stem character
  const isValid = command.trim().startsWith("/") && command.trim().length > 1

  // Extract the stem filter for autocomplete (the word after /)
  const stemFilter = (() => {
    const trimmed = command.trim()
    if (!trimmed.startsWith("/")) return ""
    const parts = trimmed.slice(1).split(" ")
    // Only show autocomplete while still typing the stem (no space yet, or just the stem portion)
    return parts[0] ?? ""
  })()

  const handleInputChange = useCallback(
    (value: string) => {
      setCommand(value)
      setAutocompleteIndex(0)
      // Show autocomplete when user types "/" at the start
      if (value.trim().startsWith("/")) {
        // Hide once args are being typed (stem selected, has space)
        const afterSlash = value.trim().slice(1)
        const hasSpace = afterSlash.includes(" ")
        setShowAutocomplete(!hasSpace)
      } else {
        setShowAutocomplete(false)
      }
    },
    [],
  )

  const handleSelectCommand = useCallback(
    (stem: string) => {
      setCommand(`/${stem} `)
      setShowAutocomplete(false)
    },
    [],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showAutocomplete) return

      const totalItems = projectCommands.length + 4 // 4 native commands (approximate)
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setAutocompleteIndex((i) => Math.min(i + 1, totalItems - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setAutocompleteIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Tab" || (e.key === "Enter" && showAutocomplete)) {
        e.preventDefault()
        // Select the item at autocompleteIndex
        const allItems = [
          ...projectCommands.map((c) => c.stem),
          "compact",
          "clear",
          "cost",
          "model",
        ]
        const stem = allItems[autocompleteIndex]
        if (stem) handleSelectCommand(stem)
      } else if (e.key === "Escape") {
        setShowAutocomplete(false)
      }
    },
    [showAutocomplete, autocompleteIndex, projectCommands, handleSelectCommand],
  )

  const handleRun = async () => {
    if (!isValid) return
    const trimmed = command.trim()
    const stem = trimmed.slice(1).split(" ")[0]
    const args = trimmed.slice(stem.length + 2).trim()
    try {
      const res = await launchCommand.mutateAsync({
        projectId,
        stem,
        args: args || undefined,
        worktreeId: null,
        effort: effort === "auto" ? null : effort,
        skipPermissions,
      })
      if (res.warning) {
        addToast("info", res.warningMessage ?? "Multiple runs active on this worktree.")
      }
      setCommand("")
      focusRun(res.runId)
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to launch run")
    }
  }

  const handleRawTerminal = async () => {
    try {
      const res = await launchRaw.mutateAsync({
        projectId,
        worktreeId: null,
        skipPermissions,
      })
      focusRun(res.runId)
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to open raw terminal")
    }
  }

  const handleResume = async (sessionId: string | undefined, runId: string) => {
    if (!sessionId) {
      // No session to resume — just focus the run
      focusRun(runId)
      return
    }
    try {
      const res = await resumeRun.mutateAsync({ sessionId, projectId, worktreeId: null })
      focusRun(res.runId)
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to resume run")
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-[#dce8f5]">Launch</h3>

      {/* Command input with autocomplete */}
      <div className="space-y-1" ref={inputContainerRef}>
        <CommandInput
          value={command}
          onChange={handleInputChange}
          onFocus={() => {
            if (command.trim().startsWith("/") && !command.includes(" ")) {
              setShowAutocomplete(true)
            }
          }}
          onBlur={() => {
            // Delay hide so onMouseDown on autocomplete item fires first
            setTimeout(() => setShowAutocomplete(false), 150)
          }}
          onKeyDown={handleKeyDown}
          placeholder="/ for commands"
          autoFocus={false}
        />
        {showAutocomplete && (
          <CommandAutocomplete
            filter={stemFilter}
            projectCommands={projectCommands}
            selectedIndex={autocompleteIndex}
            onSelect={handleSelectCommand}
            onChangeIndex={setAutocompleteIndex}
          />
        )}
      </div>

      {/* Controls row: Worktree + Effort */}
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
            onChange={(e) => setEffort(e.target.value as EffortLevel)}
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
        onClick={() => void handleRun()}
        disabled={!isValid || launchCommand.isPending}
        className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
          bg-[#4195e8] text-white hover:bg-[#5aabf5] transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Run command"
      >
        <Play size={14} />
        {launchCommand.isPending ? "Launching…" : "Run"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#263245]" />
        <span className="text-xs text-[#607896]">or</span>
        <div className="flex-1 h-px bg-[#263245]" />
      </div>

      {/* Raw Claude Terminal button */}
      <button
        onClick={() => void handleRawTerminal()}
        disabled={launchRaw.isPending}
        className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
          border border-[#263245] text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Open Raw Claude Terminal"
      >
        <Terminal size={14} />
        {launchRaw.isPending ? "Opening…" : "Open Raw Claude Terminal"}
      </button>

      {/* Recent runs */}
      {recentRuns.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs text-[#607896] uppercase tracking-wider font-medium">Recent</p>
          <div className="space-y-1">
            {recentRuns.map((run) => {
              const label = run.commandStem
                ? `/${run.commandStem}${run.commandArgs ? ` ${run.commandArgs}` : ""}`
                : (run.type === "raw" ? "Raw Terminal" : run.id)
              return (
                <div
                  key={run.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#1f2a3e] transition-colors"
                >
                  <RecentRunStatus status={run.status} />
                  <button
                    onClick={() => focusRun(run.id)}
                    className="flex-1 text-left text-xs font-mono text-[#a8bdd4] hover:text-[#dce8f5] truncate"
                  >
                    {label}
                  </button>
                  {run.durationSeconds != null && (
                    <span className="text-xs text-[#607896] tabular-nums shrink-0">
                      {formatDuration(run.durationSeconds)}
                    </span>
                  )}
                  {run.costUsd != null && (
                    <span className="text-xs text-[#607896] tabular-nums shrink-0">
                      ${run.costUsd.toFixed(2)}
                    </span>
                  )}
                  <button
                    onClick={() => void handleResume(undefined, run.id)}
                    disabled={resumeRun.isPending}
                    className="p-1 rounded text-[#607896] hover:text-[#4195e8] hover:bg-[#1f2a3e] transition-colors shrink-0"
                    aria-label={`Resume ${label}`}
                    title="Resume session"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {recentRuns.length === 0 && (
        <p className="text-xs text-[#607896] text-center pt-2">No runs yet for this project.</p>
      )}
    </div>
  )
}
