"use client"

import { Download, Plus } from "lucide-react"
import { useState } from "react"

import { ImportWizard } from "@/components/library/ImportWizard"
import { LibraryFilters } from "@/components/library/LibraryFilters"
import { LibraryGrid } from "@/components/library/LibraryGrid"
import { LibraryItemForm } from "@/components/library/LibraryItemForm"
import { LibraryItemModal } from "@/components/library/LibraryItemModal"
import { useLibraryItems } from "@/hooks/use-library"
import type { LibraryFilters as LibraryFiltersType, LibraryItemSummary } from "@/lib/api/schemas/library"

export default function LibraryPage() {
  const [filters, setFilters] = useState<LibraryFiltersType>({})
  const [selectedItem, setSelectedItem] = useState<LibraryItemSummary | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const { data: items = [], isLoading } = useLibraryItems(filters)

  // Use unfiltered items to compute tab counts
  const { data: allItems = [] } = useLibraryItems({})

  const hasFilters = Boolean(filters.type || filters.source || filters.tags?.length || filters.q)

  function handleClearFilters() {
    setFilters({})
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#263245] px-6 py-4 flex-shrink-0">
        <h1 className="text-[32px] font-bold tracking-[-1px] text-[#dce8f5]">Library</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#263245] px-3 py-2 text-sm font-medium text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
          >
            <Download size={14} />
            Import
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#4195e8] px-3 py-2 text-sm font-medium text-white hover:bg-[#5aabf5] transition-colors"
          >
            <Plus size={14} />
            New
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-[#263245] px-6 py-4 flex-shrink-0">
        <LibraryFilters
          filters={filters}
          items={allItems}
          onChange={setFilters}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <LibraryGrid
          items={items}
          isLoading={isLoading}
          searchQuery={filters.q}
          hasFilters={hasFilters}
          onItemClick={setSelectedItem}
          onClearFilters={handleClearFilters}
          onImportClick={() => setShowImport(true)}
        />
      </div>

      {/* Item detail modal */}
      {selectedItem && (
        <LibraryItemModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-2xl rounded-xl border border-[#263245] bg-[#192030] shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#263245] px-6 py-4">
              <h2 className="text-lg font-semibold text-[#dce8f5]">New Library Item</h2>
              <button
                onClick={() => setShowCreate(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-[#607896] hover:bg-[#1f2a3e] hover:text-[#dce8f5] transition-colors"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5">
              <LibraryItemForm
                onSuccess={() => setShowCreate(false)}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Import wizard */}
      {showImport && (
        <ImportWizard
          onClose={() => setShowImport(false)}
          onImportComplete={() => setShowImport(false)}
        />
      )}
    </div>
  )
}
