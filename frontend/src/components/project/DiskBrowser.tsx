"use client"

import { useState, useEffect } from "react"
import { X, Folder, ChevronRight, ArrowLeft, Circle } from "lucide-react"
import { useBrowseDirectory } from "@/hooks/use-projects"
import type { DirectoryEntry } from "@/lib/api/schemas/project"

interface DiskBrowserProps {
  initialPath: string
  onSelect: (path: string) => void
  onClose: () => void
}

export function DiskBrowser({ initialPath, onSelect, onClose }: DiskBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || "~")
  const [browsing, setBrowsing] = useState(true)

  const { data, isLoading, error } = useBrowseDirectory(currentPath, browsing)

  // Reset to home if no initial path given
  useEffect(() => {
    if (!initialPath) setCurrentPath("~")
    else setCurrentPath(initialPath)
  }, [initialPath])

  function navigateTo(path: string) {
    setCurrentPath(path)
    setBrowsing(true)
  }

  function goUp() {
    if (data?.parentPath) {
      setCurrentPath(data.parentPath)
    }
  }

  function handleSelect() {
    onSelect(data?.currentPath ?? currentPath)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        className="fixed right-0 top-0 h-full w-[420px] z-50 flex flex-col bg-[#192030] border-l border-[#263245] shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        role="dialog"
        aria-modal="true"
        aria-label="Browse Filesystem"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#263245]">
          <span className="text-[#dce8f5] text-sm font-medium">Browse Filesystem</span>
          <button
            onClick={onClose}
            className="border border-[#263245] bg-transparent hover:bg-[#1f2a3e] text-[#dce8f5] rounded-lg p-1.5 transition-colors"
            aria-label="Close browser"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current path + up */}
        <div className="px-4 py-2 border-b border-[#263245] bg-[#1f2a3e]">
          <p className="text-[#8299b8] text-xs font-mono truncate">{data?.currentPath ?? currentPath}</p>
          {data?.parentPath && (
            <button
              onClick={goUp}
              className="mt-1 flex items-center gap-1 text-[#4195e8] hover:text-[#5aabf5] text-xs transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Up
            </button>
          )}
        </div>

        {/* Directory listing */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-[#1f2a3e] rounded animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="p-4 text-[#f25c5c] text-sm">
              {error instanceof Error ? error.message : "Failed to load directory"}
            </div>
          )}

          {!isLoading && !error && data?.entries.length === 0 && (
            <div className="p-4 text-[#8299b8] text-sm">No subdirectories found</div>
          )}

          {!isLoading && !error && data?.entries.map((entry: DirectoryEntry) => (
            <DirectoryRow
              key={entry.path}
              entry={entry}
              onNavigate={navigateTo}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#263245]">
          <button
            onClick={handleSelect}
            disabled={isLoading || Boolean(error)}
            className="w-full bg-[#4195e8] hover:bg-[#5aabf5] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Select This Directory
          </button>
        </div>
      </div>
    </>
  )
}

interface DirectoryRowProps {
  entry: DirectoryEntry
  onNavigate: (path: string) => void
}

function DirectoryRow({ entry, onNavigate }: DirectoryRowProps) {
  return (
    <button
      onClick={() => onNavigate(entry.path)}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1f2a3e] transition-colors border-b border-[#263245]/50 text-left"
    >
      <Folder className="w-4 h-4 text-[#607896] flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <span className="text-[#dce8f5] text-sm truncate block">{entry.name}/</span>
        {entry.childrenCount > 0 && (
          <span className="text-[#607896] text-xs">
            {entry.childrenCount} {entry.childrenCount === 1 ? "dir" : "dirs"}
          </span>
        )}
      </div>

      {/* Project candidate marker */}
      {entry.isProjectCandidate && (
        <span className="flex items-center gap-1 text-[10px] font-medium text-[#5ecf3a] flex-shrink-0">
          <Circle className="w-1.5 h-1.5 fill-current" />
          project
        </span>
      )}

      <ChevronRight className="w-3 h-3 text-[#607896] flex-shrink-0" />
    </button>
  )
}
