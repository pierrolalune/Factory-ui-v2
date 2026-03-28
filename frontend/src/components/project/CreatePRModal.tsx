"use client"

import { useState } from "react"
import { CheckCircle, ExternalLink, GitPullRequest, Loader2, X } from "lucide-react"
import { useCreatePR, useListPRs, useRemoteInfo } from "@/hooks/use-github"

interface CreatePRModalProps {
  projectId: string
  headBranch: string
  onClose: () => void
}

export function CreatePRModal({ projectId, headBranch, onClose }: CreatePRModalProps) {
  const { data: remote } = useRemoteInfo(projectId)
  const { data: existingPRs } = useListPRs(projectId, headBranch)
  const createMutation = useCreatePR(projectId)

  const existingPR = existingPRs?.[0]

  const [title, setTitle] = useState(`feat: ${headBranch.replace(/^feat\//, "")}`)
  const [baseBranch, setBaseBranch] = useState(remote?.defaultBranch ?? "main")
  const [body, setBody] = useState(
    "## Summary\n\n- \n\n---\n🤖 Generated with Factory UI",
  )
  const [createdPR, setCreatedPR] = useState<{ number: number; url: string } | null>(null)
  const [error, setError] = useState("")

  if (existingPR) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-[#192030] border border-[#263245] rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#dce8f5] flex items-center gap-2">
              <GitPullRequest size={14} className="text-[#4195e8]" />
              Pull Request
            </h3>
            <button onClick={onClose} className="text-[#607896] hover:text-[#dce8f5]">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-[#a8bdd4]">
            PR #{existingPR.number} already exists for this branch.
          </p>
          <a
            href={existingPR.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#4195e8] hover:underline"
          >
            View PR #{existingPR.number} <ExternalLink size={12} />
          </a>
        </div>
      </div>
    )
  }

  if (createdPR) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-[#192030] border border-[#263245] rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-[#22c55e]" />
            <h3 className="text-sm font-semibold text-[#dce8f5]">PR #{createdPR.number} opened!</h3>
          </div>
          <a
            href={createdPR.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#4195e8] hover:underline"
          >
            View on GitHub <ExternalLink size={12} />
          </a>
          <div className="mt-4">
            <button
              onClick={onClose}
              className="text-xs text-[#8299b8] hover:text-[#dce8f5]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  function handleSubmit() {
    if (!title.trim()) return
    setError("")
    createMutation.mutate(
      { headBranch, baseBranch, title, body },
      {
        onSuccess: (pr) => setCreatedPR({ number: pr.number, url: pr.url }),
        onError: (err) => setError(err.message),
      },
    )
  }

  const INPUT_CLS =
    "w-full px-3 py-2 text-sm bg-[#10161f] border border-[#263245] rounded-lg text-[#dce8f5] placeholder-[#607896] focus:outline-none focus:ring-1 focus:ring-[#4195e8]"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#192030] border border-[#263245] rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-[#dce8f5] flex items-center gap-2">
            <GitPullRequest size={14} className="text-[#4195e8]" />
            Open Pull Request
          </h3>
          <button onClick={onClose} className="text-[#607896] hover:text-[#dce8f5]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-[#8299b8] mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_CLS}
              placeholder="feat: describe your change"
            />
          </div>

          {/* Base branch */}
          <div>
            <label className="block text-xs text-[#8299b8] mb-1">Base branch</label>
            <input
              type="text"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs text-[#8299b8] mb-1">Description (optional)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {error && (
            <p className="text-xs text-[#f25c5c]">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[#a8bdd4] border border-[#263245] rounded-lg hover:bg-[#1f2a3e] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim() || createMutation.isPending}
              className="px-4 py-2 text-sm bg-[#4195e8] text-white rounded-lg hover:bg-[#5aabf5]
                transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {createMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Open Pull Request
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
