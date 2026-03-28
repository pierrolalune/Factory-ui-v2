"use client"

import { useState } from "react"
import { AlertCircle, GitPullRequest, Info, GitBranch, Loader2, Plus, Trash2, X } from "lucide-react"
import Link from "next/link"
import { useBranches, useCreateWorktree, useDeleteWorktree, useWorktrees } from "@/hooks/use-worktrees"
import { useRemoteInfo } from "@/hooks/use-github"
import type { Worktree } from "@/lib/api/schemas/git"
import { PushButton } from "./PushButton"
import { CreatePRModal } from "./CreatePRModal"

// ──────────────────────────────────────────────────────────────────────────────
// Delete confirmation dialog
// ──────────────────────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  worktree: Worktree
  onConfirm: (deleteBranch: boolean) => void
  onCancel: () => void
  isPending: boolean
}

function DeleteWorktreeDialog({ worktree, onConfirm, onCancel, isPending }: DeleteDialogProps) {
  const [deleteBranch, setDeleteBranch] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#192030] border border-[#263245] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 className="text-sm font-semibold text-[#dce8f5] mb-2">
          Delete worktree {worktree.branch}?
        </h3>
        <p className="text-xs text-[#8299b8] mb-4">
          This will remove the worktree directory and its uncommitted changes.
          The git branch &ldquo;{worktree.branch}&rdquo; will be kept.
        </p>
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={deleteBranch}
            onChange={(e) => setDeleteBranch(e.target.checked)}
            className="accent-[#f25c5c]"
          />
          <span className="text-xs text-[#a8bdd4]">Delete branch too</span>
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-3 py-2 text-xs border border-[#263245] text-[#a8bdd4] rounded-lg
              hover:bg-[#1f2a3e] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(deleteBranch)}
            disabled={isPending}
            className="px-3 py-2 text-xs bg-[#f25c5c] text-white rounded-lg
              hover:opacity-80 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isPending && <Loader2 size={12} className="animate-spin" />}
            Delete Worktree
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Create worktree form
// ──────────────────────────────────────────────────────────────────────────────

interface CreateFormProps {
  projectId: string
  onClose: () => void
}

function CreateWorktreeForm({ projectId, onClose }: CreateFormProps) {
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [branch, setBranch] = useState("")
  const [baseBranch, setBaseBranch] = useState("")
  const [error, setError] = useState("")

  const { data: branches } = useBranches(projectId)
  const createMutation = useCreateWorktree(projectId)

  const defaultBase = branches?.current ?? "main"

  function handleSubmit() {
    if (!branch.trim()) return
    setError("")
    createMutation.mutate(
      {
        branch: branch.trim(),
        baseBranch: baseBranch || defaultBase,
        createBranch: mode === "new",
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <div className="border-b border-[#263245] bg-[#1f2a3e] p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-[#dce8f5]">New Worktree</h4>
        <button
          onClick={onClose}
          className="text-[#607896] hover:text-[#dce8f5] transition-colors"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Mode radio */}
      <div className="flex gap-4 mb-3">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={mode === "new"}
            onChange={() => setMode("new")}
            className="accent-[#4195e8]"
          />
          <span className="text-xs text-[#a8bdd4]">Create new branch</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            checked={mode === "existing"}
            onChange={() => setMode("existing")}
            className="accent-[#4195e8]"
          />
          <span className="text-xs text-[#a8bdd4]">Check out existing branch</span>
        </label>
      </div>

      {/* Branch name */}
      <div className="mb-3">
        <label className="block text-xs text-[#8299b8] mb-1">Branch name *</label>
        {mode === "new" ? (
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="feat/my-feature"
            className="w-full px-3 py-2 text-xs bg-[#10161f] border border-[#263245] rounded-lg
              text-[#dce8f5] placeholder-[#607896] focus:outline-none focus:ring-1 focus:ring-[#4195e8]"
          />
        ) : (
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#10161f] border border-[#263245] rounded-lg
              text-[#dce8f5] focus:outline-none focus:ring-1 focus:ring-[#4195e8]"
          >
            <option value="">Select branch…</option>
            {branches?.local.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Base branch (new only) */}
      {mode === "new" && (
        <div className="mb-3">
          <label className="block text-xs text-[#8299b8] mb-1">Create from (base branch)</label>
          <select
            value={baseBranch || defaultBase}
            onChange={(e) => setBaseBranch(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#10161f] border border-[#263245] rounded-lg
              text-[#dce8f5] focus:outline-none focus:ring-1 focus:ring-[#4195e8]"
          >
            {branches?.local.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1 text-xs text-[#f25c5c] mb-2">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!branch.trim() || createMutation.isPending}
        className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-[#4195e8] text-white
          hover:bg-[#2d7dd4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed
          flex items-center justify-center gap-2"
      >
        {createMutation.isPending && <Loader2 size={12} className="animate-spin" />}
        Create Worktree
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Worktree card
// ──────────────────────────────────────────────────────────────────────────────

interface WorktreeCardProps {
  projectId: string
  worktree: Worktree
  onDelete: (wt: Worktree) => void
  onOpenGit: (wt: Worktree) => void
}

function WorktreeCard({ projectId, worktree, onDelete, onOpenGit }: WorktreeCardProps) {
  const [showPRModal, setShowPRModal] = useState(false)
  const { data: remote } = useRemoteInfo(projectId)

  return (
    <div className="border border-[#263245] bg-[#1f2a3e] rounded-xl p-3 space-y-1">
      <div className="flex items-center gap-2">
        <GitBranch size={14} className="text-[#4195e8] shrink-0" />
        <span className="text-sm font-medium text-[#dce8f5] truncate">{worktree.branch}</span>
      </div>
      <p className="text-xs text-[#607896]">Created from: {worktree.baseBranch}</p>

      {/* Status */}
      {worktree.isDirty ? (
        <p className="text-xs text-[#f59e0b]">
          ● {worktree.ahead > 0
            ? `${worktree.ahead} commit${worktree.ahead !== 1 ? "s" : ""} ahead · uncommitted changes`
            : "uncommitted changes"}
        </p>
      ) : worktree.ahead > 0 ? (
        <p className="text-xs text-[#22c55e]">
          ✓ {worktree.ahead} commit{worktree.ahead !== 1 ? "s" : ""} ahead · Clean
        </p>
      ) : (
        <p className="text-xs text-[#22c55e]">✓ Clean</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* GitHub push */}
        <PushButton projectId={projectId} worktree={worktree} />

        {/* Open PR */}
        {remote && worktree.ahead > 0 && (
          <button
            onClick={() => setShowPRModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#1f2a3e] border border-[#263245]
              text-[#a8bdd4] rounded-lg hover:text-[#dce8f5] hover:border-[#4195e8] transition-colors"
          >
            <GitPullRequest size={11} />
            Open PR
          </button>
        )}

        <button
          onClick={() => onOpenGit(worktree)}
          className="px-2 py-1 text-xs border border-[#263245] text-[#a8bdd4] rounded hover:bg-[#263245] transition-colors"
        >
          Git
        </button>
        <button
          onClick={() => onDelete(worktree)}
          className="px-2 py-1 text-xs border border-[#f25c5c]/30 text-[#f25c5c] rounded
            hover:bg-[#f25c5c]/10 transition-colors flex items-center gap-1"
        >
          <Trash2 size={10} />
          Delete
        </button>
      </div>

      {showPRModal && (
        <CreatePRModal
          projectId={projectId}
          headBranch={worktree.branch}
          onClose={() => setShowPRModal(false)}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Main panel
// ──────────────────────────────────────────────────────────────────────────────

interface WorktreePanelProps {
  projectId: string
  onOpenGit?: (worktreePath: string) => void
}

export function WorktreePanel({ projectId, onOpenGit }: WorktreePanelProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Worktree | null>(null)

  const { data: worktrees, isLoading } = useWorktrees(projectId)
  const { isError: noGitHub } = useRemoteInfo(projectId)
  const deleteMutation = useDeleteWorktree(projectId)

  function handleDeleteConfirm(deleteBranch: boolean) {
    if (!deleteTarget) return
    deleteMutation.mutate(
      { worktreeId: deleteTarget.id, deleteBranch },
      { onSuccess: () => setDeleteTarget(null) },
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#263245]">
        <h3 className="text-sm font-semibold text-[#dce8f5]">Worktrees</h3>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-[#1f2a3e] border border-[#263245]
            text-[#a8bdd4] rounded-lg hover:text-[#dce8f5] hover:border-[#4195e8] transition-colors"
        >
          <Plus size={12} />
          New Worktree
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateWorktreeForm projectId={projectId} onClose={() => setShowCreate(false)} />
      )}

      {/* Worktree list */}
      <div className="p-4 space-y-3">
        {isLoading && (
          <>
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-24 bg-[#1f2a3e] rounded-xl animate-pulse" />
            ))}
          </>
        )}

        {!isLoading && (!worktrees || worktrees.length === 0) && (
          <div className="border border-[#263245] bg-[#1f2a3e] rounded-xl p-6 text-center">
            <GitBranch size={24} className="text-[#263245] mx-auto mb-2" />
            <p className="text-sm text-[#8299b8]">No worktrees yet.</p>
            <p className="text-xs text-[#607896] mt-1">
              Create one to run agents in isolation.
            </p>
          </div>
        )}

        {worktrees?.map((wt) => (
          <WorktreeCard
            key={wt.id}
            projectId={projectId}
            worktree={wt}
            onDelete={setDeleteTarget}
            onOpenGit={(w) => onOpenGit?.(w.path)}
          />
        ))}
      </div>

      {/* GitHub not configured hint */}
      {noGitHub && (
        <div className="mx-4 mb-4 px-3 py-2 rounded-lg bg-[#1f2a3e] border border-[#263245] flex items-start gap-2">
          <Info size={12} className="text-[#607896] mt-0.5 shrink-0" />
          <p className="text-xs text-[#607896]">
            Connect GitHub to push branches and open PRs.{" "}
            <Link href="/settings" className="text-[#4195e8] hover:underline">
              Configure in Settings →
            </Link>
          </p>
        </div>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteWorktreeDialog
          worktree={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
