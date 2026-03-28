"use client"

import { create } from "zustand"

export interface Toast {
  id: string
  type: "success" | "error" | "info" | "action"
  message: string
  href?: string
  runId?: string
}

interface ToastStore {
  toasts: Toast[]
  addToast: (type: Toast["type"], message: string, href?: string) => void
  addActionToast: (runId: string, message: string, href: string) => void
  removeToast: (id: string) => void
  dismissByRunId: (runId: string) => void
}

const MAX_TOASTS = 5

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],

  addToast: (type, message, href) =>
    set((state) => {
      const newToast: Toast = {
        id: `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        message,
        href,
      }
      // Keep newest on top, max 5 visible
      const toasts = [newToast, ...state.toasts].slice(0, MAX_TOASTS)
      return { toasts }
    }),

  addActionToast: (runId, message, href) =>
    set((state) => {
      // Deduplicate by runId — replace existing toast for same run
      const filtered = state.toasts.filter((t) => t.runId !== runId)
      const newToast: Toast = {
        id: `toast-action-${runId}`,
        type: "action",
        message,
        href,
        runId,
      }
      const toasts = [newToast, ...filtered].slice(0, MAX_TOASTS)
      return { toasts }
    }),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  dismissByRunId: (runId) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.runId !== runId),
    })),
}))
