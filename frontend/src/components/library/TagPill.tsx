import { X } from "lucide-react"

interface TagPillProps {
  tag: string
  onRemove?: (tag: string) => void
}

export function TagPill({ tag, onRemove }: TagPillProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#263245] bg-[#1f2a3e] px-2.5 py-0.5 text-xs text-[#a8bdd4]">
      {tag}
      {onRemove && (
        <button
          onClick={() => onRemove(tag)}
          aria-label={`Remove tag ${tag}`}
          className="ml-0.5 rounded-full p-0.5 text-[#607896] hover:text-[#dce8f5] transition-colors"
        >
          <X size={10} />
        </button>
      )}
    </span>
  )
}
