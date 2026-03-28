import type { LibraryItemSummary } from "@/lib/api/schemas/library"
import { LibraryItemCard } from "./LibraryItemCard"

interface LibraryGridProps {
  items: LibraryItemSummary[]
  isLoading: boolean
  searchQuery?: string
  hasFilters: boolean
  onItemClick: (item: LibraryItemSummary) => void
  onClearFilters: () => void
  onImportClick: () => void
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#263245] bg-[#192030] p-4 space-y-3">
      <div className="h-4 w-2/3 rounded bg-[#1f2a3e] animate-pulse" />
      <div className="h-3 w-1/4 rounded-full bg-[#1f2a3e] animate-pulse" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-[#1f2a3e] animate-pulse" />
        <div className="h-3 w-4/5 rounded bg-[#1f2a3e] animate-pulse" />
      </div>
      <div className="flex gap-1">
        <div className="h-5 w-16 rounded-full bg-[#1f2a3e] animate-pulse" />
        <div className="h-5 w-14 rounded-full bg-[#1f2a3e] animate-pulse" />
      </div>
    </div>
  )
}

export function LibraryGrid({
  items,
  isLoading,
  searchQuery,
  hasFilters,
  onItemClick,
  onClearFilters,
  onImportClick,
}: LibraryGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    if (searchQuery) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-[#8299b8]">No items match &ldquo;{searchQuery}&rdquo;.</p>
          <button onClick={onClearFilters} className="mt-2 text-sm text-[#4195e8] hover:underline">
            Clear search
          </button>
        </div>
      )
    }
    if (hasFilters) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-[#8299b8]">No items match your filters.</p>
          <button onClick={onClearFilters} className="mt-2 text-sm text-[#4195e8] hover:underline">
            Clear filters
          </button>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-[#8299b8]">
          Your library is empty.{" "}
          <button onClick={onImportClick} className="text-[#4195e8] hover:underline">
            Import from a .claude/ folder
          </button>{" "}
          or create a new item.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <LibraryItemCard key={item.id} item={item} onClick={onItemClick} />
      ))}
    </div>
  )
}
