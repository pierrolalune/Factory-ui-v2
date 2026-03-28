"use client"

interface ReconnectingOverlayProps {
  reconnecting: boolean
  attemptsExhausted: boolean
  attempt: number
  onRetry: () => void
}

/** Semi-transparent overlay shown during WS reconnect attempts. */
export function ReconnectingOverlay({
  reconnecting,
  attemptsExhausted,
  attempt,
  onRetry,
}: ReconnectingOverlayProps) {
  if (!reconnecting && !attemptsExhausted) return null

  return (
    <div className="absolute inset-0 bg-[#10161f]/80 flex items-center justify-center z-10">
      {reconnecting && (
        <div className="text-center space-y-1">
          <p className="text-sm text-[#a8bdd4]">Reconnecting…</p>
          <p className="text-xs text-[#607896]">Attempt {attempt} of 5</p>
        </div>
      )}
      {attemptsExhausted && (
        <div className="text-center space-y-3">
          <p className="text-sm text-[#a8bdd4]">Connection lost after 5 attempts.</p>
          <button
            onClick={onRetry}
            className="rounded-lg px-4 py-2 text-sm font-medium
              bg-[#4195e8] text-white hover:bg-[#5aabf5] transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
