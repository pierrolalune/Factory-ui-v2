"use client"

import { AlertTriangle, Check, X } from "lucide-react"
import { useState } from "react"

import { useImportItems, useScanClaude } from "@/hooks/use-library"
import { useProjects } from "@/hooks/use-projects"
import type { ImportResult, ScannedItem } from "@/lib/api/schemas/library"
import { TypeBadge } from "./TypeBadge"

interface ImportWizardProps {
  onClose: () => void
  onImportComplete?: () => void
}

type Step = 1 | 2 | 3

interface SelectionState {
  [sourcePath: string]: { selected: boolean; overwrite: boolean }
}

export function ImportWizard({ onClose, onImportComplete }: ImportWizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [path, setPath] = useState("")
  const [scanRoot, setScanRoot] = useState("")
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [selection, setSelection] = useState<SelectionState>({})
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  const scanMutation = useScanClaude()
  const importMutation = useImportItems()
  const { data: projects = [] } = useProjects()

  async function handleScan() {
    setScanError(null)
    try {
      const result = await scanMutation.mutateAsync(path)
      setScanRoot(result.scanRoot)
      setScannedItems(result.items)
      // Default: select all new items, deselect already-in-library
      const initial: SelectionState = {}
      for (const item of result.items) {
        initial[item.sourcePath] = { selected: !item.alreadyInLibrary, overwrite: false }
      }
      setSelection(initial)
      setStep(2)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed"
      setScanError(msg.includes("path_not_found") ? "Path not found." : msg.includes("no_claude_dir") ? "No .claude/ directory found at this path." : msg)
    }
  }

  async function handleImport() {
    const items = Object.entries(selection)
      .filter(([, s]) => s.selected)
      .map(([sourcePath, s]) => ({ sourcePath, overwrite: s.overwrite }))

    const result = await importMutation.mutateAsync({ scanRoot, items })
    setImportResult(result)
    setStep(3)
    onImportComplete?.()
  }

  const selectedCount = Object.values(selection).filter((s) => s.selected).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-[#263245] bg-[#192030] shadow-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#263245] px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#dce8f5]">
              {step === 3 ? "Import Complete" : "Import from .claude/"}
            </h2>
            {step === 2 && (
              <p className="text-xs text-[#607896] mt-0.5">{scanRoot}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#607896] hover:bg-[#1f2a3e] hover:text-[#dce8f5] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <Step1
              path={path}
              onPathChange={setPath}
              projects={projects}
              onProjectClick={(p) => setPath(p)}
              error={scanError}
            />
          )}
          {step === 2 && (
            <Step2
              items={scannedItems}
              selection={selection}
              onSelectionChange={setSelection}
            />
          )}
          {step === 3 && importResult && (
            <Step3 result={importResult} scannedItems={scannedItems} selection={selection} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#263245] px-6 py-4 flex items-center justify-end gap-2 flex-shrink-0">
          {step === 1 && (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-[#263245] px-4 py-2 text-sm font-medium text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScan}
                disabled={!path.trim() || scanMutation.isPending}
                className="rounded-lg bg-[#4195e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#5aabf5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {scanMutation.isPending ? "Scanning…" : "Scan →"}
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border border-[#263245] px-4 py-2 text-sm font-medium text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importMutation.isPending}
                className="rounded-lg bg-[#4195e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#5aabf5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importMutation.isPending ? "Importing…" : `Import Selected (${selectedCount}) →`}
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button
                onClick={() => { setStep(1); setPath(""); setScanError(null) }}
                className="rounded-lg border border-[#263245] px-4 py-2 text-sm font-medium text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
              >
                Import More
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-[#4195e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#5aabf5] transition-colors"
              >
                View Library
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — path input
// ---------------------------------------------------------------------------

interface Step1Props {
  path: string
  onPathChange: (p: string) => void
  projects: Array<{ id: string; name: string; path: string }>
  onProjectClick: (path: string) => void
  error: string | null
}

function Step1({ path, onPathChange, projects, onProjectClick, error }: Step1Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#a8bdd4]">
        Enter the path to a project containing a <code className="text-[#4195e8]">.claude/</code> folder:
      </p>
      <div className="space-y-1">
        <input
          type="text"
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          placeholder="/Users/you/code/my-project"
          className="w-full rounded-lg border border-[#263245] bg-[#1f2a3e] px-3 py-2 text-sm text-[#dce8f5] placeholder:text-[#607896] focus:border-[#4195e8] focus:outline-none focus:ring-2 focus:ring-[#4195e8]"
        />
        {error && (
          <div className="flex items-center gap-1.5 text-sm text-[#f25c5c]">
            <AlertTriangle size={12} />
            {error}
          </div>
        )}
      </div>
      {projects.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#8299b8]">
            Or pick a project
          </p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onProjectClick(p.path)}
                className="w-full rounded-lg border border-[#263245] px-3 py-2.5 text-left hover:bg-[#1f2a3e] transition-colors"
              >
                <div className="text-sm font-medium text-[#dce8f5]">{p.name}</div>
                <div className="text-xs text-[#607896] truncate">{p.path}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — item selection
// ---------------------------------------------------------------------------

interface Step2Props {
  items: ScannedItem[]
  selection: SelectionState
  onSelectionChange: (s: SelectionState) => void
}

function Step2({ items, selection, onSelectionChange }: Step2Props) {
  const grouped = groupByType(items)
  const selectedCount = Object.values(selection).filter((s) => s.selected).length

  function toggleAll() {
    const allSelected = selectedCount === items.length
    const next: SelectionState = {}
    for (const item of items) {
      next[item.sourcePath] = { ...selection[item.sourcePath], selected: !allSelected }
    }
    onSelectionChange(next)
  }

  function toggleItem(sourcePath: string) {
    onSelectionChange({
      ...selection,
      [sourcePath]: { ...selection[sourcePath], selected: !selection[sourcePath]?.selected },
    })
  }

  function toggleOverwrite(sourcePath: string) {
    const current = selection[sourcePath]
    onSelectionChange({
      ...selection,
      [sourcePath]: { ...current, overwrite: !current.overwrite, selected: !current.overwrite },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#a8bdd4]">Found {items.length} items</span>
        <button onClick={toggleAll} className="text-xs text-[#4195e8] hover:underline">
          {selectedCount === items.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      {Object.entries(grouped).map(([type, typeItems]) => (
        <div key={type} className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8299b8]">
            {type} ({typeItems.length})
            {type === "agent" && (
              <span className="ml-2 normal-case text-[#607896]">— imported for reference only</span>
            )}
          </p>
          <div className="rounded-lg border border-[#263245] divide-y divide-[#263245]">
            {typeItems.map((item) => {
              const state = selection[item.sourcePath] ?? { selected: false, overwrite: false }
              return (
                <div key={item.sourcePath} className="flex items-start gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={state.selected}
                    onChange={() => toggleItem(item.sourcePath)}
                    className="mt-0.5 accent-[#4195e8]"
                    aria-label={`Select ${item.name}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#dce8f5]">{item.name}</span>
                      <TypeBadge type={item.type} />
                      {item.alreadyInLibrary && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#f59e0b]">
                          <AlertTriangle size={10} />
                          Already in library
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8299b8] truncate">{item.description}</p>
                    {item.alreadyInLibrary && (
                      <label className="mt-1 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={state.overwrite}
                          onChange={() => toggleOverwrite(item.sourcePath)}
                          className="accent-[#f59e0b]"
                        />
                        <span className="text-xs text-[#f59e0b]">Overwrite with this version</span>
                      </label>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function groupByType(items: ScannedItem[]): Record<string, ScannedItem[]> {
  const order = ["command", "workflow", "skill", "agent", "claude-md"]
  const result: Record<string, ScannedItem[]> = {}
  for (const type of order) {
    const filtered = items.filter((i) => i.type === type)
    if (filtered.length > 0) result[type] = filtered
  }
  return result
}

// ---------------------------------------------------------------------------
// Step 3 — results
// ---------------------------------------------------------------------------

interface Step3Props {
  result: ImportResult
  scannedItems: ScannedItem[]
  selection: SelectionState
}

function Step3({ result, scannedItems, selection }: Step3Props) {
  const importedItems = scannedItems.filter(
    (i) => selection[i.sourcePath]?.selected && !selection[i.sourcePath]?.overwrite,
  )

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Check size={16} className="text-[#22c55e]" />
          <span className="text-[#dce8f5]">
            <strong>{result.imported}</strong> item{result.imported !== 1 ? "s" : ""} imported
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <X size={16} className="text-[#8299b8]" />
          <span className="text-[#8299b8]">
            <strong>{result.skipped}</strong> item{result.skipped !== 1 ? "s" : ""} skipped (already in library)
          </span>
        </div>
        {result.overwritten > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Check size={16} className="text-[#f59e0b]" />
            <span className="text-[#f59e0b]">
              <strong>{result.overwritten}</strong> item{result.overwritten !== 1 ? "s" : ""} overwritten
            </span>
          </div>
        )}
        {result.errors.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle size={16} className="text-[#f25c5c]" />
            <span className="text-[#f25c5c]">
              <strong>{result.errors.length}</strong> error{result.errors.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {importedItems.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[#8299b8]">Imported</p>
          <div className="rounded-lg border border-[#263245] divide-y divide-[#263245] max-h-48 overflow-y-auto">
            {importedItems.map((item) => (
              <div key={item.sourcePath} className="flex items-center gap-3 px-3 py-2">
                <span className="text-sm text-[#dce8f5]">{item.name}</span>
                <TypeBadge type={item.type} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
