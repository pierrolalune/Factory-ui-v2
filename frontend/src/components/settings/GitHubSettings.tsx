"use client"

import { useState } from "react"
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { useSaveGitHubToken, useRemoveGitHubToken } from "@/hooks/use-settings"
import type { Settings } from "@/lib/api/schemas/settings"

interface GitHubSettingsProps {
  settings: Settings
}

export function GitHubSettings({ settings }: GitHubSettingsProps) {
  const [editing, setEditing] = useState(!settings.githubTokenSet)
  const [tokenInput, setTokenInput] = useState("")
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const saveToken = useSaveGitHubToken()
  const removeToken = useRemoveGitHubToken()

  async function handleSaveToken() {
    setInlineError(null)
    try {
      await saveToken.mutateAsync(tokenInput)
      setTokenInput("")
      setEditing(false)
    } catch {
      setInlineError("Invalid token — make sure it has the 'repo' scope")
    }
  }

  async function handleRemoveToken() {
    await removeToken.mutateAsync()
    setConfirmRemove(false)
    setEditing(true)
  }

  return (
    <div className="space-y-4">
      {/* Token set state */}
      {settings.githubTokenSet && !editing ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={settings.githubTokenMasked ?? ""}
              className="flex-1 border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg
                px-3 py-2 text-sm font-mono"
              aria-label="Masked GitHub token"
            />
          </div>
          {settings.githubUsername && (
            <p className="flex items-center gap-2 text-sm text-[#a8bdd4]">
              <CheckCircle size={14} className="text-[#22c55e]" />
              Connected as:{" "}
              <a
                href={`https://github.com/${settings.githubUsername}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#4195e8] hover:text-[#5aabf5]"
              >
                {settings.githubUsername}
              </a>
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-[#263245] bg-transparent px-4 py-2 text-sm
                font-medium text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
            >
              Update
            </button>
            {!confirmRemove ? (
              <button
                onClick={() => setConfirmRemove(true)}
                className="rounded-lg border border-[#263245] bg-transparent px-4 py-2 text-sm
                  font-medium text-[#f25c5c] hover:bg-red-950/40 transition-colors"
              >
                Remove
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#a8bdd4]">Remove token?</span>
                <button
                  onClick={handleRemoveToken}
                  disabled={removeToken.isPending}
                  className="rounded-lg bg-[#f25c5c]/10 border border-[#f25c5c]/30 px-3 py-1.5
                    text-sm font-medium text-[#f25c5c] hover:bg-[#f25c5c]/20 transition-colors
                    disabled:opacity-50"
                >
                  {removeToken.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "Confirm"
                  )}
                </button>
                <button
                  onClick={() => setConfirmRemove(false)}
                  className="text-sm text-[#8299b8] hover:text-[#dce8f5] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Token not set / editing state */
        <div className="space-y-3">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg
              px-3 py-2 text-sm placeholder:text-[#607896]
              focus:outline-none focus:ring-2 focus:ring-[#4195e8] focus:border-[#4195e8]"
            aria-label="GitHub personal access token"
          />
          {inlineError && (
            <p className="flex items-center gap-2 text-sm text-[#f25c5c]">
              <AlertCircle size={14} />
              {inlineError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSaveToken}
              disabled={!tokenInput || saveToken.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#4195e8] px-4 py-2 text-sm
                font-medium text-white hover:bg-[#5aabf5] transition-colors disabled:opacity-50"
            >
              {saveToken.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Save Token
            </button>
            {settings.githubTokenSet && (
              <button
                onClick={() => {
                  setEditing(false)
                  setTokenInput("")
                  setInlineError(null)
                }}
                className="rounded-lg border border-[#263245] bg-transparent px-4 py-2 text-sm
                  font-medium text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-[#607896]">
        Required scope:{" "}
        <code className="font-mono text-[#8299b8]">repo</code> ·{" "}
        <a
          href="https://github.com/settings/tokens/new?scopes=repo"
          target="_blank"
          rel="noreferrer"
          className="text-[#4195e8] hover:text-[#5aabf5]"
        >
          How to create a token →
        </a>
      </p>
    </div>
  )
}
