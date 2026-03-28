"use client"

import { useState } from "react"
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitCommit,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react"
import {
  useCommit,
  useDiscardChanges,
  useGitDiff,
  useGitLog,
  useGitStatus,
  useStageFiles,
  useUnstageFiles,
} from "@/hooks/use-git"
import type { GitFileChange } from "@/lib/api/schemas/git"
import { DiffViewer } from "./DiffViewer"

// Relative time formatting (simple)
function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (h < 1) return "just now"
  if (h < 24) return `${h}h ago`
  if (d === 1) return "Yesterday"
  return `${d}d ago`
}

// Change type badge
function ChangeBadge({ type }: { type: string }) {
  const label =
    type === "modified" ? "M" : type === "added" ? "A" : type === "deleted" ? "D" : "R"
  const color =
    type === "modified"
      ? "text-[#f59e0b]"
      : type === "added"
        ? "text-[#22c55e]"
        : type === "deleted"
          ? "text-[#f25c5c]"
          : "text-[#4195e8]"
  return <span className={`text-xs font-mono font-bold w-4 shrink-0 ${color}`}>{label}</span>
}

interface GitFileRowProps {
  file: GitFileChange
  staged: boolean
  projectId: string
  worktreePath?: string
  onStage: (path: string) => void
  onUnstage: (path: string) => void
  onDiscard: (path: string) => void
}

function GitFileRow({
  file,
  staged,
  projectId,
  worktreePath,
  onStage,
  onUnstage,
  onDiscard,
}: GitFileRowProps) {
  const [diffOpen, setDiffOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const { data: diff, isLoading: diffLoading } = useGitDiff(
    projectId,
    diffOpen ? file.path : null,
    staged,
    worktreePath,
  )

  return (
    <div>
      <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1f2a3e] rounded">
        {/* Checkbox for stage/unstage */}
        <input
          type="checkbox"
          checked={staged}
          onChange={() => (staged ? onUnstage(file.path) : onStage(file.path))}
          className="accent-[#4195e8] shrink-0"
          aria-label={staged ? `Unstage ${file.path}` : `Stage ${file.path}`}
        />
        <ChangeBadge type={file.changeType} />
        {/* File path */}
        <span
          className="flex-1 text-xs text-[#dce8f5] truncate"
          title={file.path}
        >
          {file.path}
        </span>
        {/* Discard button (unstaged tracked files only) */}
        {!staged && file.changeType !== "added" && (
          <button
            onClick={() => setConfirmDiscard(true)}
            className="text-[#607896] hover:text-[#f25c5c] transition-colors p-0.5"
            title="Discard changes"
            aria-label={`Discard changes to ${file.path}`}
          >
            <Trash2 size={12} />
          </button>
        )}
        {/* Diff toggle */}
        <button
          onClick={() => setDiffOpen((v) => !v)}
          className="text-xs text-[#607896] hover:text-[#4195e8] flex items-center gap-0.5 transition-colors"
          aria-label={diffOpen ? "Collapse diff" : "Expand diff"}
        >
          {diffOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          diff
        </button>
      </div>

      {/* Discard confirmation */}
      {confirmDiscard && (
        <div className="mx-3 my-1 p-2 bg-[#1f2a3e] border border-[#f25c5c]/30 rounded text-xs">
          <p className="text-[#f25c5c] mb-2">Discard changes to {file.path}? This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDiscard(file.path)
                setConfirmDiscard(false)
              }}
              className="px-2 py-1 bg-[#f25c5c] text-white rounded text-xs hover:opacity-80"
            >
              Discard
            </button>
            <button
              onClick={() => setConfirmDiscard(false)}
              className="px-2 py-1 border border-[#263245] text-[#a8bdd4] rounded text-xs hover:bg-[#263245]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inline diff */}
      {diffOpen && (
        <div className="mx-3 mb-2">
          {diffLoading ? (
            <div className="flex items-center gap-2 p-3 text-xs text-[#607896]">
              <Loader2 size={12} className="animate-spin" />
              Loading diff…
            </div>
          ) : diff ? (
            <DiffViewer diff={diff} />
          ) : null}
        </div>
      )}
    </div>
  )
}

interface UntrackedRowProps {
  path: string
  onStage: (path: string) => void
}

function UntrackedRow({ path, onStage }: UntrackedRowProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#1f2a3e] rounded">
      <input
        type="checkbox"
        checked={false}
        onChange={() => onStage(path)}
        className="accent-[#4195e8] shrink-0"
        aria-label={`Stage ${path}`}
      />
      <span className="text-xs font-mono font-bold w-4 shrink-0 text-[#8299b8]">?</span>
      <span className="flex-1 text-xs text-[#dce8f5] truncate" title={path}>
        {path}
      </span>
    </div>
  )
}

interface GitPanelProps {
  projectId: string
  worktreePath?: string
}

export function GitPanel({ projectId, worktreePath }: GitPanelProps) {
  const [commitMessage, setCommitMessage] = useState("")

  const { data: status, isLoading, error, refetch } = useGitStatus(projectId, worktreePath)
  const { data: log } = useGitLog(projectId, worktreePath)

  const stageMutation = useStageFiles(projectId)
  const unstageMutation = useUnstageFiles(projectId)
  const discardMutation = useDiscardChanges(projectId)
  const commitMutation = useCommit(projectId)

  function handleStage(path: string) {
    stageMutation.mutate({ paths: [path], worktreePath })
  }
  function handleUnstage(path: string) {
    unstageMutation.mutate({ paths: [path], worktreePath })
  }
  function handleDiscard(path: string) {
    discardMutation.mutate({ paths: [path], worktreePath })
  }
  function handleStageAll() {
    const paths = [
      ...status!.unstaged.map((f) => f.path),
      ...status!.untracked,
    ]
    if (paths.length > 0) stageMutation.mutate({ paths, worktreePath })
  }
  function handleUnstageAll() {
    if (status && status.staged.length > 0) {
      unstageMutation.mutate({ paths: status.staged.map((f) => f.path), worktreePath })
    }
  }
  function handleCommit() {
    if (!commitMessage.trim() || !status?.staged.length) return
    commitMutation.mutate(
      { message: commitMessage.trim(), worktreePath },
      {
        onSuccess: () => {
          setCommitMessage("")
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 bg-[#1f2a3e] rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    const msg = error.message ?? "Git error"
    if (msg.includes("not a git repository")) {
      return (
        <div className="p-4">
          <div className="flex items-center gap-2 text-[#f25c5c] text-sm">
            <AlertCircle size={16} />
            This project is not a git repository.
          </div>
        </div>
      )
    }
    if (msg.toLowerCase().includes("git not found") || msg.toLowerCase().includes("not found")) {
      return (
        <div className="p-4">
          <div className="flex items-center gap-2 text-[#f25c5c] text-sm">
            <AlertCircle size={16} />
            git not found. Make sure git is installed and in PATH.
          </div>
        </div>
      )
    }
    return (
      <div className="p-4 text-sm text-[#f25c5c]">
        <AlertCircle size={16} className="inline mr-1" />
        {msg}
      </div>
    )
  }

  if (!status) return null

  const stagedCount = status.staged.length
  const hasUnstaged = status.unstaged.length + status.untracked.length > 0

  return (
    <div className="flex flex-col gap-0 text-sm">
      {/* Header: branch + refresh */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#263245]">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-[#4195e8]" />
          <span className="text-xs font-mono text-[#dce8f5]">{status.branch}</span>
          {status.ahead > 0 && (
            <span className="text-xs text-[#22c55e]">↑{status.ahead}</span>
          )}
          {status.behind > 0 && (
            <span className="text-xs text-[#f59e0b]">↓{status.behind}</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-[#607896] hover:text-[#dce8f5] transition-colors p-1 rounded hover:bg-[#1f2a3e]"
          title="Refresh"
          aria-label="Refresh git status"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Clean state */}
      {!status.isDirty && (
        <div className="px-4 py-6 text-center text-xs text-[#607896]">
          Nothing to commit. Working tree clean.
        </div>
      )}

      {/* Staged section */}
      {stagedCount > 0 && (
        <div>
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-semibold text-[#8299b8]">
              Staged ({stagedCount})
            </span>
            <button
              onClick={handleUnstageAll}
              className="text-xs text-[#607896] hover:text-[#dce8f5] transition-colors"
            >
              Unstage All
            </button>
          </div>
          {status.staged.map((f) => (
            <GitFileRow
              key={f.path}
              file={f}
              staged
              projectId={projectId}
              worktreePath={worktreePath}
              onStage={handleStage}
              onUnstage={handleUnstage}
              onDiscard={handleDiscard}
            />
          ))}
        </div>
      )}

      {/* Unstaged section */}
      {hasUnstaged && (
        <div>
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-semibold text-[#8299b8]">
              Unstaged ({status.unstaged.length + status.untracked.length})
            </span>
            <button
              onClick={handleStageAll}
              className="text-xs text-[#607896] hover:text-[#dce8f5] transition-colors"
            >
              Stage All
            </button>
          </div>
          {status.unstaged.map((f) => (
            <GitFileRow
              key={f.path}
              file={f}
              staged={false}
              projectId={projectId}
              worktreePath={worktreePath}
              onStage={handleStage}
              onUnstage={handleUnstage}
              onDiscard={handleDiscard}
            />
          ))}
          {status.untracked.map((path) => (
            <UntrackedRow key={path} path={path} onStage={handleStage} />
          ))}
        </div>
      )}

      {/* Commit section */}
      {status.isDirty && (
        <div className="px-4 py-3 border-t border-[#263245]">
          <p className="text-xs font-semibold text-[#8299b8] mb-2">Commit</p>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message"
            disabled={commitMutation.isPending}
            className="w-full px-3 py-2 text-xs bg-[#10161f] border border-[#263245] rounded-lg
              text-[#dce8f5] placeholder-[#607896] focus:outline-none focus:ring-1 focus:ring-[#4195e8]
              disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleCommit()
            }}
          />
          {commitMutation.error && (
            <p className="mt-1 text-xs text-[#f25c5c]">{commitMutation.error.message}</p>
          )}
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || stagedCount === 0 || commitMutation.isPending}
            className="mt-2 w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors
              bg-[#4195e8] text-white hover:bg-[#2d7dd4]
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {commitMutation.isPending ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Committing…
              </>
            ) : (
              `Commit (${stagedCount} file${stagedCount !== 1 ? "s" : ""})`
            )}
          </button>
        </div>
      )}

      {/* Recent commits */}
      {log && log.length > 0 && (
        <div className="px-4 py-3 border-t border-[#263245]">
          <p className="text-xs font-semibold text-[#8299b8] mb-2">Recent Commits</p>
          <div className="space-y-1.5">
            {log.map((c) => (
              <div key={c.hash} className="flex items-start gap-2">
                <GitCommit size={12} className="text-[#607896] mt-0.5 shrink-0" />
                <span className="font-mono text-xs text-[#607896] shrink-0">{c.hash}</span>
                <span className="text-xs text-[#a8bdd4] truncate flex-1" title={c.message}>
                  {c.message}
                </span>
                <span className="text-xs text-[#607896] shrink-0 whitespace-nowrap">
                  {relativeTime(c.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
