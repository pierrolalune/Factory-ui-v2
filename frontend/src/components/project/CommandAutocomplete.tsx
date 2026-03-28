"use client"

import { useEffect, useRef } from "react"
import { Library } from "lucide-react"
import { useRouter } from "next/navigation"
import type { CommandInfo } from "@/lib/api/schemas/run"

const NATIVE_COMMANDS = [
  { stem: "compact", name: "Compact", description: "Compact conversation history" },
  { stem: "clear", name: "Clear", description: "Clear conversation" },
  { stem: "cost", name: "Cost", description: "Show session cost" },
  { stem: "model", name: "Model", description: "Switch model" },
] as const

interface CommandAutocompleteProps {
  filter: string
  projectCommands: CommandInfo[]
  selectedIndex: number
  onSelect: (stem: string) => void
  onChangeIndex: (index: number) => void
}

function filterCommands<T extends { stem: string; description: string }>(
  commands: ReadonlyArray<T>,
  filter: string,
): T[] {
  if (!filter) return commands as T[]
  const lower = filter.toLowerCase()
  return commands.filter(
    (c) => c.stem.toLowerCase().includes(lower) || c.description.toLowerCase().includes(lower),
  )
}

/** Autocomplete dropdown for slash commands. Shown when input contains "/". */
export function CommandAutocomplete({
  filter,
  projectCommands,
  selectedIndex,
  onSelect,
  onChangeIndex,
}: CommandAutocompleteProps) {
  const router = useRouter()
  const listRef = useRef<HTMLDivElement | null>(null)

  const filteredProject = filterCommands(projectCommands, filter)
  const filteredNative = filterCommands(NATIVE_COMMANDS, filter)
  const totalItems = filteredProject.length + filteredNative.length

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  if (totalItems === 0 && projectCommands.length === 0) {
    return (
      <div className="rounded-lg border border-[#263245] bg-[#192030] shadow-md overflow-hidden">
        <div className="px-3 py-3 text-xs text-[#8299b8] space-y-2">
          <p>No commands installed in this project.</p>
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              router.push("/library")
            }}
            className="flex items-center gap-1.5 text-[#4195e8] hover:text-[#5aabf5] transition-colors"
          >
            <Library size={12} />
            Add from Library
          </button>
        </div>
      </div>
    )
  }

  if (totalItems === 0) {
    return (
      <div className="rounded-lg border border-[#263245] bg-[#192030] shadow-md overflow-hidden">
        <div className="px-3 py-2 text-xs text-[#607896]">No matching commands</div>
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className="rounded-lg border border-[#263245] bg-[#192030] shadow-md overflow-hidden max-h-60 overflow-y-auto"
      role="listbox"
    >
      {/* Project commands */}
      {filteredProject.length > 0 && (
        <>
          {filteredProject.map((cmd, idx) => (
            <button
              key={cmd.stem}
              data-idx={idx}
              role="option"
              aria-selected={selectedIndex === idx}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(cmd.stem)
              }}
              onMouseEnter={() => onChangeIndex(idx)}
              className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors
                ${selectedIndex === idx ? "bg-[#1f2a3e]" : "hover:bg-[#1f2a3e]"}`}
            >
              <span className="text-sm font-mono text-[#4195e8] shrink-0">/{cmd.stem}</span>
              <span className="text-xs text-[#8299b8] truncate flex-1">{cmd.description}</span>
              <span className="text-[10px] text-[#607896] shrink-0">project</span>
            </button>
          ))}
        </>
      )}

      {/* Divider between project and native */}
      {filteredProject.length > 0 && filteredNative.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1">
          <div className="flex-1 h-px bg-[#263245]" />
          <span className="text-[10px] text-[#607896] uppercase tracking-wider">native</span>
          <div className="flex-1 h-px bg-[#263245]" />
        </div>
      )}

      {/* Native commands */}
      {filteredNative.map((cmd, i) => {
        const idx = filteredProject.length + i
        return (
          <button
            key={cmd.stem}
            data-idx={idx}
            role="option"
            aria-selected={selectedIndex === idx}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(cmd.stem)
            }}
            onMouseEnter={() => onChangeIndex(idx)}
            className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors
              ${selectedIndex === idx ? "bg-[#1f2a3e]" : "hover:bg-[#1f2a3e]"}`}
          >
            <span className="text-sm font-mono text-[#a8bdd4] shrink-0">/{cmd.stem}</span>
            <span className="text-xs text-[#8299b8] truncate flex-1">{cmd.description}</span>
          </button>
        )
      })}
    </div>
  )
}
