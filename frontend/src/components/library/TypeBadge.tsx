import type { LibraryItemType } from "@/lib/api/schemas/library"

interface TypeBadgeProps {
  type: LibraryItemType
}

const TYPE_CONFIG: Record<LibraryItemType, { label: string; color: string; bg: string }> = {
  command: { label: "Command", color: "#4195e8", bg: "rgba(65,149,232,0.12)" },
  workflow: { label: "Workflow", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  skill: { label: "Skill", color: "#14b8a6", bg: "rgba(20,184,166,0.12)" },
  "claude-md": { label: "Claude MD", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  agent: { label: "Agent", color: "#8299b8", bg: "rgba(130,153,184,0.12)" },
}

export function TypeBadge({ type }: TypeBadgeProps) {
  const { label, color, bg } = TYPE_CONFIG[type] ?? TYPE_CONFIG.skill

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider"
      style={{ color, backgroundColor: bg, border: `1px solid ${color}30` }}
    >
      {label}
    </span>
  )
}
