"use client"

import { useRef, useEffect } from "react"

interface CommandInputProps {
  value: string
  onChange: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  autoFocus?: boolean
}

/** Single-line command input that expands to multi-line on Shift+Enter. */
export function CommandInput({
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  placeholder = "/ for commands",
  autoFocus,
}: CommandInputProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  // Auto-resize the textarea height based on content
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Suppress Shift+Enter from submitting — it adds a newline (handled by textarea default)
    if (e.key === "Enter" && !e.shiftKey) {
      // Let parent decide what to do on plain Enter (e.g., submit)
    }
    onKeyDown?.(e)
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="w-full resize-none overflow-hidden
        border border-[#263245] bg-[#1f2a3e] text-[#dce8f5]
        placeholder:text-[#607896]
        focus:ring-2 focus:ring-[#4195e8] focus:border-[#4195e8]
        rounded-lg px-3 py-2 text-sm outline-none transition-colors font-mono
        leading-5"
    />
  )
}
