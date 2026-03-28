import type { LibraryItemSource, LibraryItemSummary } from "@/lib/api/schemas/library"
import { TagPill } from "./TagPill"
import { TypeBadge } from "./TypeBadge"

interface LibraryItemCardProps {
  item: LibraryItemSummary
  onClick: (item: LibraryItemSummary) => void
}

const SOURCE_CONFIG: Record<LibraryItemSource, { label: string; className: string }> = {
  builtin: { label: "Built-in", className: "text-[#8299b8] border-[#263245]" },
  user: { label: "Mine", className: "text-[#22c55e] border-[#22c55e]/40" },
  imported: { label: "Imported", className: "text-[#607896] border-[#607896]/40" },
}

function SourceBadge({ source }: { source: LibraryItemSource }) {
  const { label, className } = SOURCE_CONFIG[source]
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  )
}

export function LibraryItemCard({ item, onClick }: LibraryItemCardProps) {
  return (
    <button
      onClick={() => onClick(item)}
      className="w-full text-left border border-[#263245] bg-[#192030] rounded-lg p-4 hover:bg-[#1f2a3e] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4195e8]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-[#dce8f5] leading-tight">{item.name}</h3>
        <SourceBadge source={item.source} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <TypeBadge type={item.type} />
      </div>
      <p className="text-sm text-[#a8bdd4] line-clamp-3 mb-3">{item.description}</p>
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 4).map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
          {item.tags.length > 4 && (
            <span className="text-xs text-[#607896]">+{item.tags.length - 4}</span>
          )}
        </div>
      )}
    </button>
  )
}
