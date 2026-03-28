import { Ban, CheckCircle, Circle, Loader2, XCircle } from "lucide-react"

interface RunStatusBadgeProps {
  status: string
  className?: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: {
    label: "Completed",
    color: "#22c55e",
    icon: <CheckCircle size={12} />,
  },
  failed: {
    label: "Failed",
    color: "#f25c5c",
    icon: <XCircle size={12} />,
  },
  cancelled: {
    label: "Cancelled",
    color: "#607896",
    icon: <Ban size={12} />,
  },
  active: {
    label: "Running",
    color: "#5ecf3a",
    icon: <Loader2 size={12} className="animate-spin" />,
  },
  awaiting_input: {
    label: "Awaiting Input",
    color: "#f59e0b",
    icon: <Circle size={12} className="animate-pulse" />,
  },
  pending: {
    label: "Pending",
    color: "#8299b8",
    icon: <Circle size={12} />,
  },
}

export function RunStatusBadge({ status, className = "" }: RunStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}
      style={{ color: cfg.color }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}
