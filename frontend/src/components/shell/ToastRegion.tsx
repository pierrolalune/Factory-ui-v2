"use client"

import { useEffect, useRef } from "react"
import { CheckCircle, XCircle, Info, Bell, X } from "lucide-react"
import { useToastStore, type Toast } from "@/store/toast-store"

const BORDER_COLOR: Record<Toast["type"], string> = {
  success: "#22c55e",
  error: "#f25c5c",
  info: "#3b82f6",
  action: "#f59e0b",
}

function ToastIcon({ type }: { type: Toast["type"] }) {
  const cls = "shrink-0"
  if (type === "success") return <CheckCircle size={16} className={cls} style={{ color: "#22c55e" }} />
  if (type === "error") return <XCircle size={16} className={cls} style={{ color: "#f25c5c" }} />
  if (type === "info") return <Info size={16} className={cls} style={{ color: "#3b82f6" }} />
  return <Bell size={16} className={cls} style={{ color: "#f59e0b" }} />
}

interface ToastItemProps {
  toast: Toast
}

function ToastItem({ toast }: ToastItemProps) {
  const removeToast = useToastStore((s) => s.removeToast)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Action toasts never auto-dismiss
    if (toast.type === "action") return

    timerRef.current = setTimeout(() => {
      removeToast(toast.id)
    }, 4_000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, toast.type, removeToast])

  const borderColor = BORDER_COLOR[toast.type]

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex w-[360px] items-start gap-3 rounded-lg border bg-[#192030] p-4 shadow-lg"
      style={{ borderColor }}
    >
      <ToastIcon type={toast.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#dce8f5]">{toast.message}</p>
        {toast.href && (
          <a
            href={toast.href}
            className="mt-1 block text-xs text-[#4195e8] hover:text-[#5aabf5] transition-colors"
          >
            View run →
          </a>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 text-[#607896] hover:text-[#dce8f5] transition-colors"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastRegion() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
