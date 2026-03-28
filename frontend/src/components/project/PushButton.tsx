"use client"

import { useState } from "react"
import { CheckCircle, ExternalLink, GitBranch, Loader2, Upload, AlertCircle } from "lucide-react"
import { usePushBranch, useRemoteInfo } from "@/hooks/use-github"
import type { Worktree } from "@/lib/api/schemas/git"

interface PushButtonProps {
  projectId: string
  worktree: Worktree
}

type PushState = "idle" | "loading" | "success" | "rejected"

export function PushButton({ projectId, worktree }: PushButtonProps) {
  const [pushState, setPushState] = useState<PushState>("idle")
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [forceMode, setForceMode] = useState(false)

  const { data: remote, isError: noRemote } = useRemoteInfo(projectId)
  const pushMutation = usePushBranch(projectId)

  // Only show if there are commits ahead and GitHub is configured
  if (noRemote || !remote || worktree.ahead === 0) return null

  function handlePush(force = false) {
    setPushState("loading")
    setForceMode(false)
    pushMutation.mutate(
      { branch: worktree.branch, worktreePath: worktree.path, force },
      {
        onSuccess: (data) => {
          setPushState("success")
          setRemoteUrl(data.remoteUrl)
        },
        onError: (err) => {
          if (err.message.toLowerCase().includes("rejected")) {
            setPushState("rejected")
          } else {
            setPushState("idle")
          }
        },
      },
    )
  }

  if (pushState === "success") {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle size={12} className="text-[#22c55e]" />
        <span className="text-xs text-[#22c55e]">Pushed</span>
        {remoteUrl && (
          <a
            href={remoteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#4195e8] hover:underline flex items-center gap-0.5"
          >
            View <ExternalLink size={10} />
          </a>
        )}
      </div>
    )
  }

  if (pushState === "rejected") {
    return (
      <div className="flex items-center gap-1.5">
        <AlertCircle size={12} className="text-[#f59e0b]" />
        <span className="text-xs text-[#f59e0b]">Rejected</span>
        <button
          onClick={() => handlePush(true)}
          className="text-xs text-[#f25c5c] hover:underline"
        >
          Force push?
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => handlePush(forceMode)}
      disabled={pushState === "loading"}
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-[#1f2a3e] border border-[#263245]
        text-[#a8bdd4] rounded-lg hover:text-[#dce8f5] hover:border-[#4195e8] transition-colors
        disabled:opacity-50"
    >
      {pushState === "loading" ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <Upload size={11} />
      )}
      <GitBranch size={11} />
      Push
    </button>
  )
}
