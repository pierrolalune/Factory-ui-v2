"use client"

import { Check, ChevronDown, Trash2, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useDeleteLibraryItem, useLibraryItem, useCopyToProject } from "@/hooks/use-library"
import { useProjects } from "@/hooks/use-projects"
import type { LibraryItemSummary } from "@/lib/api/schemas/library"
import { LibraryItemForm } from "./LibraryItemForm"
import { TagPill } from "./TagPill"
import { TypeBadge } from "./TypeBadge"

interface LibraryItemModalProps {
  item: LibraryItemSummary
  onClose: () => void
}

export function LibraryItemModal({ item: summary, onClose }: LibraryItemModalProps) {
  const { data: item, isLoading } = useLibraryItem(summary.id)
  const deleteMutation = useDeleteLibraryItem()
  const copyMutation = useCopyToProject()
  const { data: projects = [] } = useProjects()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const isBuiltin = summary.source === "builtin"

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  async function handleDelete() {
    await deleteMutation.mutateAsync(summary.id)
    onClose()
  }

  async function handleCopyToProject(projectId: string) {
    setProjectDropdownOpen(false)
    setCopyStatus(null)
    try {
      const result = await copyMutation.mutateAsync({ itemId: summary.id, projectId })
      setCopyStatus({ ok: true, message: `Copied to ${result.copiedTo}` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Copy failed"
      const isExisting = msg.includes("already_exists")
      setCopyStatus({
        ok: false,
        message: isExisting ? "This item already exists in that project's .claude/ folder" : msg,
      })
    }
  }

  if (isEditing && item) {
    return (
      <ModalShell onClose={onClose} title={`Edit: ${item.name}`}>
        <LibraryItemForm
          item={item}
          onSuccess={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      </ModalShell>
    )
  }

  return (
    <ModalShell onClose={onClose} title={summary.name}>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-[#1f2a3e] animate-pulse" />
          ))}
        </div>
      ) : item ? (
        <div className="space-y-5">
          {/* Header badges */}
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={item.type} />
            <span className="text-xs text-[#8299b8] capitalize">{item.source}</span>
          </div>

          <p className="text-sm text-[#a8bdd4]">{item.description}</p>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
          )}

          {/* Content */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#8299b8]">Content</h4>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[#263245] bg-[#10161f] p-4">
              <pre className="whitespace-pre-wrap font-mono text-xs text-[#dce8f5]">{item.content}</pre>
            </div>
          </div>

          {/* Config (command only) */}
          {item.config && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-[#8299b8]">Config</h4>
              <div className="rounded-lg border border-[#263245] bg-[#10161f] px-4 py-3">
                <code className="text-xs text-[#4195e8]">{item.config.command}</code>
              </div>
            </div>
          )}

          {/* Copy status */}
          {copyStatus && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                copyStatus.ok
                  ? "border-green-500/30 bg-green-950/30 text-[#22c55e]"
                  : "border-red-500/30 bg-red-950/30 text-[#f25c5c]"
              }`}
            >
              {copyStatus.ok && <Check size={12} className="mr-1.5 inline" />}
              {copyStatus.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-[#263245] pt-4">
            <div className="flex items-center gap-2">
              {!isBuiltin && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-lg border border-[#263245] px-3 py-1.5 text-sm font-medium text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
                  >
                    Edit
                  </button>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#f25c5c]">Delete?</span>
                      <button
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg bg-red-950/40 border border-red-500/30 px-3 py-1.5 text-sm font-medium text-[#f25c5c] hover:bg-red-950/60 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="rounded-lg border border-[#263245] px-2 py-1.5 text-sm text-[#8299b8] hover:bg-[#1f2a3e] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="rounded-lg border border-[#263245] px-3 py-1.5 text-sm font-medium text-[#f25c5c] hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 size={14} className="inline mr-1" />
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Copy to project */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProjectDropdownOpen((o) => !o)}
                disabled={copyMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-[#4195e8] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5aabf5] transition-colors disabled:opacity-50"
              >
                {copyMutation.isPending ? "Copying…" : "Copy to Project"}
                <ChevronDown size={14} />
              </button>
              {projectDropdownOpen && (
                <div className="absolute right-0 bottom-full mb-1 z-50 min-w-[220px] rounded-lg border border-[#263245] bg-[#192030] shadow-lg py-1">
                  {projects.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-[#607896]">No projects registered</p>
                  ) : (
                    projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleCopyToProject(p.id)}
                        className="block w-full px-3 py-2 text-left text-sm text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-[#607896] truncate">{p.path}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#8299b8]">Item not found.</p>
      )}
    </ModalShell>
  )
}

function ModalShell({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode
  onClose: () => void
  title: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-[#263245] bg-[#192030] shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#263245] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#dce8f5]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[#607896] hover:bg-[#1f2a3e] hover:text-[#dce8f5] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
