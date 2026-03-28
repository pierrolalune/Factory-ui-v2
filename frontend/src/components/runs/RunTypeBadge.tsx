interface RunTypeBadgeProps {
  type: string
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  command: { label: "cmd", color: "#4195e8", bg: "#4195e820" },
  raw: { label: "raw", color: "#14b8a6", bg: "#14b8a620" },
  resume: { label: "resume", color: "#8b5cf6", bg: "#8b5cf620" },
}

export function RunTypeBadge({ type }: RunTypeBadgeProps) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.command
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  )
}
