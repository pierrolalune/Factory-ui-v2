"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, FolderOpen } from "lucide-react"
import { useValidatePath, useDiscoverProjects, useCreateProject } from "@/hooks/use-projects"
import { DiskBrowser } from "@/components/project/DiskBrowser"
import type { PathInfo, DirectoryEntry } from "@/lib/api/schemas/project"

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2

interface WizardState {
  path: string
  pathInfo: PathInfo | null
  name: string
  description: string
  githubRemote: string
  initGit: boolean
  generateClaudeMd: boolean
}

const EMPTY_STATE: WizardState = {
  path: "",
  pathInfo: null,
  name: "",
  description: "",
  githubRemote: "",
  initGit: false,
  generateClaudeMd: false,
}

// Common scan locations for discover section
const SCAN_LOCATIONS = [
  { label: "~/code", path: "~/code" },
  { label: "~/Desktop", path: "~/Desktop" },
  { label: "~", path: "~" },
]

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function NewProjectWizard() {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(1)
  const [state, setState] = useState<WizardState>(EMPTY_STATE)
  const [showBrowser, setShowBrowser] = useState(false)

  // Validation trigger: only fires after user blurs the path input
  const [validateEnabled, setValidateEnabled] = useState(false)
  const {
    data: pathInfo,
    isLoading: validating,
    error: validateError,
  } = useValidatePath(state.path, validateEnabled)

  // When validation succeeds, sync pathInfo into wizard state
  const syncedPathInfo = pathInfo ?? state.pathInfo

  function handlePathBlur() {
    if (state.path.trim()) setValidateEnabled(true)
  }

  function handlePathChange(value: string) {
    setState((s) => ({ ...s, path: value }))
    // Re-run validation on next blur after change
    setValidateEnabled(false)
  }

  function handleBrowserSelect(selectedPath: string) {
    setState((s) => ({ ...s, path: selectedPath }))
    setValidateEnabled(true)
  }

  function handleDiscoverSelect(entry: DirectoryEntry) {
    setState((s) => ({ ...s, path: entry.path }))
    setValidateEnabled(true)
  }

  function goToStep2() {
    if (!syncedPathInfo?.exists || syncedPathInfo.alreadyRegistered) return
    // Auto-fill name from suggestion
    const autoName = syncedPathInfo?.suggestedName ?? state.path.split(/[/\\]/).filter(Boolean).pop() ?? ""
    setState((s) => ({
      ...s,
      pathInfo: syncedPathInfo,
      name: s.name || autoName,
      initGit: !syncedPathInfo?.isGitRepo,
      generateClaudeMd: !syncedPathInfo?.hasClaudeMd,
    }))
    setStep(2)
  }

  function goBack() {
    setStep(1)
  }

  const createProject = useCreateProject()

  async function handleCreate() {
    if (!state.path || !state.name) return
    try {
      const result = await createProject.mutateAsync({
        name: state.name.trim(),
        path: state.path,
        description: state.description.trim() || undefined,
        githubRemote: state.githubRemote.trim() || undefined,
        initGit: state.initGit,
      })
      // TODO: if generateClaudeMd checkbox is checked, call POST /api/projects/{id}/setup/generate-claude-md
      // For now we skip generation and navigate directly
      router.push(`/projects/${result.id}`)
    } catch {
      // Error is accessible via createProject.error
    }
  }

  const canProceedStep1 =
    Boolean(state.path) &&
    validateEnabled &&
    !validating &&
    !validateError &&
    syncedPathInfo?.exists === true &&
    !syncedPathInfo?.alreadyRegistered

  return (
    <div className="max-w-[640px] mx-auto px-6 py-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <StepDot active={step === 1} done={step > 1} label="1" />
        <div className="h-px w-6 bg-[#263245]" />
        <StepDot active={step === 2} done={false} label="2" />
        <span className="ml-3 text-[#8299b8] text-xs">Step {step} of 2</span>
      </div>

      {step === 1 && (
        <Step1
          path={state.path}
          validating={validating}
          validateEnabled={validateEnabled}
          validateError={validateError instanceof Error ? validateError.message : null}
          pathInfo={syncedPathInfo}
          onPathChange={handlePathChange}
          onPathBlur={handlePathBlur}
          onBrowse={() => setShowBrowser(true)}
          onDiscoverSelect={handleDiscoverSelect}
          onCancel={() => router.push("/projects")}
          onNext={goToStep2}
          canNext={canProceedStep1}
        />
      )}

      {step === 2 && (
        <Step2
          path={state.path}
          pathInfo={syncedPathInfo}
          name={state.name}
          description={state.description}
          githubRemote={state.githubRemote}
          initGit={state.initGit}
          generateClaudeMd={state.generateClaudeMd}
          submitting={createProject.isPending}
          submitError={createProject.error?.message ?? null}
          onChange={(field, value) => setState((s) => ({ ...s, [field]: value }))}
          onBack={goBack}
          onCreate={handleCreate}
        />
      )}

      {/* Disk browser slide-over */}
      {showBrowser && (
        <DiskBrowser
          initialPath={state.path || "~"}
          onSelect={handleBrowserSelect}
          onClose={() => setShowBrowser(false)}
        />
      )}
    </div>
  )
}

// ─── Step Dot ────────────────────────────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  const bg = active ? "bg-[#4195e8]" : done ? "bg-[#22c55e]" : "bg-[#263245]"
  const text = active || done ? "text-white" : "text-[#8299b8]"
  return (
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  )
}

// ─── Step 1: Pick Directory ───────────────────────────────────────────────────

interface Step1Props {
  path: string
  validating: boolean
  validateEnabled: boolean
  validateError: string | null
  pathInfo: PathInfo | null
  onPathChange: (v: string) => void
  onPathBlur: () => void
  onBrowse: () => void
  onDiscoverSelect: (entry: DirectoryEntry) => void
  onCancel: () => void
  onNext: () => void
  canNext: boolean
}

function Step1({
  path,
  validating,
  validateEnabled,
  validateError,
  pathInfo,
  onPathChange,
  onPathBlur,
  onBrowse,
  onDiscoverSelect,
  onCancel,
  onNext,
  canNext,
}: Step1Props) {
  const [discoverPath, setDiscoverPath] = useState("")
  const [discoverEnabled, setDiscoverEnabled] = useState(false)

  const { data: discoverData, isLoading: discovering } = useDiscoverProjects(discoverPath, discoverEnabled)

  function scanLocation(loc: string) {
    setDiscoverPath(loc)
    setDiscoverEnabled(true)
  }

  // Derive inline status feedback
  let pathFeedback: { type: "error" | "success" | "warning" | "info"; message: string } | null = null
  if (validateEnabled && !validating) {
    if (validateError) {
      pathFeedback = { type: "error", message: "Could not validate path — is the backend running?" }
    } else if (pathInfo && !pathInfo.exists) {
      pathFeedback = { type: "error", message: "Path not found on disk" }
    } else if (pathInfo?.alreadyRegistered) {
      pathFeedback = { type: "warning", message: "This project is already registered" }
    } else if (pathInfo?.exists) {
      pathFeedback = { type: "success", message: "Path found" }
    }
  }

  return (
    <div>
      <h1 className="text-[#dce8f5] text-2xl font-semibold mb-1">New Project</h1>
      <p className="text-[#8299b8] text-sm mb-6">Where is your project?</p>

      {/* Path input row */}
      <div className="flex gap-2 mb-1">
        <input
          type="text"
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          onBlur={onPathBlur}
          placeholder="/Users/pierre/code/my-app"
          className="flex-1 border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4195e8] focus:border-[#4195e8] placeholder:text-[#607896] font-mono"
          aria-label="Project path"
        />
        <button
          onClick={onBrowse}
          className="border border-[#263245] bg-transparent hover:bg-[#1f2a3e] text-[#dce8f5] rounded-lg px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5"
          aria-label="Browse filesystem"
        >
          <FolderOpen className="w-4 h-4" />
          Browse
        </button>
      </div>

      {/* Validation feedback */}
      {validating && (
        <p className="text-[#8299b8] text-xs mt-1">Validating…</p>
      )}
      {pathFeedback && (
        <p className={`text-xs mt-1 ${pathFeedback.type === "error" ? "text-[#f25c5c]" : pathFeedback.type === "warning" ? "text-[#f59e0b]" : "text-[#22c55e]"}`}>
          {pathFeedback.message}
        </p>
      )}

      {/* Detected stack pills */}
      {pathInfo?.detectedStack && pathInfo.detectedStack.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {pathInfo.detectedStack.map((s) => (
            <StackBadge key={s} label={s} />
          ))}
        </div>
      )}

      {/* Discover section */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-[#263245]" />
          <span className="text-[#607896] text-xs font-medium">Or discover projects</span>
          <div className="h-px flex-1 bg-[#263245]" />
        </div>

        <div className="flex gap-2 mb-4">
          {SCAN_LOCATIONS.map((loc) => (
            <button
              key={loc.path}
              onClick={() => scanLocation(loc.path)}
              disabled={discovering && discoverPath === loc.path}
              className="border border-[#263245] bg-transparent hover:bg-[#1f2a3e] disabled:opacity-50 text-[#dce8f5] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3 h-3" />
              Scan {loc.label}
            </button>
          ))}
        </div>

        {discovering && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-[#1f2a3e] rounded animate-pulse" />
            ))}
          </div>
        )}

        {!discovering && discoverData?.candidates && discoverData.candidates.length === 0 && (
          <p className="text-[#8299b8] text-sm">No project candidates found in {discoverPath}</p>
        )}

        {!discovering && discoverData?.candidates && discoverData.candidates.length > 0 && (
          <div className="border border-[#263245] rounded-lg overflow-hidden">
            {discoverData.candidates.map((candidate) => (
              <button
                key={candidate.path}
                onClick={() => onDiscoverSelect(candidate)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1f2a3e] transition-colors border-b border-[#263245]/50 last:border-b-0 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[#dce8f5] text-sm font-medium">{candidate.name}</p>
                  <p className="text-[#607896] text-xs font-mono truncate">{candidate.path}</p>
                </div>
                {candidate.detectedStack && candidate.detectedStack.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    {candidate.detectedStack.slice(0, 2).map((s) => (
                      <StackBadge key={s} label={s} />
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-2 mt-8">
        <button
          onClick={onCancel}
          className="border border-[#263245] bg-transparent hover:bg-[#1f2a3e] text-[#dce8f5] rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          className="bg-[#4195e8] hover:bg-[#5aabf5] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Configure ────────────────────────────────────────────────────────

interface Step2Props {
  path: string
  pathInfo: PathInfo | null
  name: string
  description: string
  githubRemote: string
  initGit: boolean
  generateClaudeMd: boolean
  submitting: boolean
  submitError: string | null
  onChange: (field: keyof WizardState, value: string | boolean) => void
  onBack: () => void
  onCreate: () => void
}

function Step2({
  path,
  pathInfo,
  name,
  description,
  githubRemote,
  initGit,
  generateClaudeMd,
  submitting,
  submitError,
  onChange,
  onBack,
  onCreate,
}: Step2Props) {
  const showSetupSection = !pathInfo?.isGitRepo || !pathInfo?.hasClaudeMd

  const canCreate = name.trim().length > 0 && !submitting

  return (
    <div>
      <h1 className="text-[#dce8f5] text-2xl font-semibold mb-1">Configure Project</h1>

      {/* Selected path summary */}
      <div className="mb-6 p-3 border border-[#263245] bg-[#1f2a3e] rounded-lg">
        <p className="text-[#8299b8] text-xs font-mono truncate">{path}</p>
        {pathInfo?.detectedStack && pathInfo.detectedStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {pathInfo.detectedStack.map((s) => (
              <StackBadge key={s} label={s} />
            ))}
          </div>
        )}
      </div>

      {/* Project Name */}
      <label className="block mb-4">
        <span className="text-[#dce8f5] text-sm font-medium block mb-1.5">
          Project Name <span className="text-[#f25c5c]">*</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="my-app"
          maxLength={64}
          className="w-full border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4195e8] focus:border-[#4195e8] placeholder:text-[#607896]"
        />
      </label>

      {/* Description */}
      <label className="block mb-4">
        <span className="text-[#a8bdd4] text-sm font-medium block mb-1.5">Description</span>
        <textarea
          value={description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="Short description of the project (optional)"
          rows={2}
          className="w-full border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4195e8] focus:border-[#4195e8] placeholder:text-[#607896] resize-none"
        />
      </label>

      {/* GitHub Remote */}
      <label className="block mb-6">
        <span className="text-[#a8bdd4] text-sm font-medium block mb-1.5">
          GitHub Remote <span className="text-[#607896] font-normal">(optional)</span>
        </span>
        <input
          type="text"
          value={githubRemote}
          onChange={(e) => onChange("githubRemote", e.target.value)}
          placeholder="git@github.com:user/repo.git"
          className="w-full border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4195e8] focus:border-[#4195e8] placeholder:text-[#607896] font-mono"
        />
      </label>

      {/* Setup section — only shown if there's something to set up */}
      {showSetupSection && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-[#263245]" />
            <span className="text-[#607896] text-xs font-medium uppercase tracking-wider">Setup</span>
            <div className="h-px flex-1 bg-[#263245]" />
          </div>

          <div className="space-y-3">
            {/* Git init — only shown if not already a repo */}
            {!pathInfo?.isGitRepo && (
              <SetupCheckbox
                checked={initGit}
                onChange={(v) => onChange("initGit", v)}
                label="Initialize git repository"
                hint="This project has no .git — recommended"
              />
            )}

            {/* Generate CLAUDE.md — only shown if no CLAUDE.md yet */}
            {!pathInfo?.hasClaudeMd && (
              <SetupCheckbox
                checked={generateClaudeMd}
                onChange={(v) => onChange("generateClaudeMd", v)}
                label="Generate CLAUDE.md with AI"
                hint="Describe your project for better results"
                // TODO: wire up CLAUDE.md generation after create (Step 3)
              />
            )}
          </div>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <p className="text-[#f25c5c] text-sm mb-4">{submitError}</p>
      )}

      {/* Footer actions */}
      <div className="flex justify-end gap-2 mt-8">
        <button
          onClick={onBack}
          disabled={submitting}
          className="border border-[#263245] bg-transparent hover:bg-[#1f2a3e] disabled:opacity-50 text-[#dce8f5] rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onCreate}
          disabled={!canCreate}
          className="bg-[#4195e8] hover:bg-[#5aabf5] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2"
        >
          {submitting ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Creating…
            </>
          ) : (
            "Create Project"
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Setup Checkbox ───────────────────────────────────────────────────────────

interface SetupCheckboxProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}

function SetupCheckbox({ checked, onChange, label, hint }: SetupCheckboxProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border border-[#263245] bg-[#1f2a3e] accent-[#4195e8] cursor-pointer"
      />
      <div>
        <span className="text-[#dce8f5] text-sm">{label}</span>
        {hint && <p className="text-[#607896] text-xs mt-0.5">{hint}</p>}
      </div>
    </label>
  )
}

// ─── Stack Badge ─────────────────────────────────────────────────────────────

function StackBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium bg-[#1f2a3e] text-[#a8bdd4] border border-[#263245]">
      {label}
    </span>
  )
}
