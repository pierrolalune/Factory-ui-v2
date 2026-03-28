"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { WS_BASE_URL } from "@/lib/constants"
import { toCamelCase } from "@/lib/utils/camel-case"
import type { Run, WsPhase, WsPhaseUpdate, WsCostUpdate } from "@/lib/api/schemas/run"

const BACKOFF_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000]

export interface RunWebSocketState {
  connected: boolean
  reconnecting: boolean
  attemptsExhausted: boolean
  /** Call to reset attempt counter and retry from scratch */
  retry: () => void
  runInfo: Run | null
  phase: WsPhaseUpdate | null
  cost: WsCostUpdate | null
  /** Write a string into the terminal — set by TerminalPane via setTerminalWrite */
  terminalWrite: (data: string) => void
  /** Called by TerminalPane to register its write callback */
  setTerminalWrite: (fn: (data: string) => void) => void
}

/** Manages a WebSocket connection to /ws/run/{runId} with exponential backoff reconnection. */
export function useRunWebSocket(runId: string | null): RunWebSocketState {
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [attemptsExhausted, setAttemptsExhausted] = useState(false)
  const [runInfo, setRunInfo] = useState<Run | null>(null)
  const [phase, setPhase] = useState<WsPhaseUpdate | null>(null)
  const [cost, setCost] = useState<WsCostUpdate | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // PTY buffer for messages arriving before xterm is ready
  const ptyBufferRef = useRef<string[]>([])
  const terminalWriteRef = useRef<((data: string) => void) | null>(null)
  // Stable reference so we can use in the effect without triggering re-renders
  const runIdRef = useRef(runId)
  runIdRef.current = runId

  const terminalWrite = useCallback((data: string) => {
    if (terminalWriteRef.current) {
      terminalWriteRef.current(data)
    } else {
      // Buffer until terminal registers its write callback
      ptyBufferRef.current.push(data)
    }
  }, [])

  const setTerminalWrite = useCallback((fn: (data: string) => void) => {
    terminalWriteRef.current = fn
    // Flush buffered output
    const buffered = ptyBufferRef.current.splice(0)
    for (const chunk of buffered) {
      fn(chunk)
    }
  }, [])

  const connect = useCallback(() => {
    const id = runIdRef.current
    if (!id) return

    const url = `${WS_BASE_URL}/ws/run/${id}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setReconnecting(false)
      setAttemptsExhausted(false)
      attemptRef.current = 0
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(event.data) as Record<string, unknown>
      } catch {
        return
      }

      // Convert snake_case keys from server to camelCase
      const msg = toCamelCase<Record<string, unknown>>(parsed)
      const type = msg.type as string

      if (type === "pty_output") {
        const b64 = msg.data as string
        // Decode base64 → binary string and write to terminal
        try {
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
          const decoded = new TextDecoder().decode(bytes)
          terminalWrite(decoded)
        } catch {
          // Fallback: write raw if decode fails
          terminalWrite(msg.data as string)
        }
      } else if (type === "runInfo") {
        setRunInfo(msg.run as Run)
      } else if (type === "statusUpdate") {
        // Update runInfo status in place if we have it
        setRunInfo((prev) => (prev ? { ...prev, status: msg.status as Run["status"] } : prev))
      } else if (type === "awaitingInputUpdate") {
        setRunInfo((prev) =>
          prev ? { ...prev, awaitingInput: msg.awaitingInput as boolean } : prev,
        )
      } else if (type === "phaseUpdate") {
        setPhase(msg as unknown as WsPhase extends string ? WsPhaseUpdate : never)
        setPhase({
          type: "phase_update",
          phase: msg.phase as WsPhase,
          toolName: msg.toolName as string | undefined,
          filePath: msg.filePath as string | undefined,
        })
      } else if (type === "costUpdate") {
        setCost({
          type: "cost_update",
          costUsd: msg.costUsd as number,
          inputTokens: msg.inputTokens as number,
          outputTokens: msg.outputTokens as number,
          numTurns: msg.numTurns as number,
        })
        setRunInfo((prev) =>
          prev ? { ...prev, totalCostUsd: msg.costUsd as number } : prev,
        )
      }
    }

    ws.onerror = () => {
      // onclose will handle reconnection
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null

      const attempt = attemptRef.current
      if (attempt >= BACKOFF_DELAYS_MS.length) {
        setReconnecting(false)
        setAttemptsExhausted(true)
        return
      }

      setReconnecting(true)
      attemptRef.current = attempt + 1
      const delay = BACKOFF_DELAYS_MS[attempt]
      retryTimerRef.current = setTimeout(() => {
        connect()
      }, delay)
    }
  }, [terminalWrite])

  const retry = useCallback(() => {
    // Clear any pending timer, reset counters, and reconnect
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    attemptRef.current = 0
    setAttemptsExhausted(false)
    setReconnecting(false)
    connect()
  }, [connect])

  useEffect(() => {
    if (!runId) return

    // Reset state for new runId
    setConnected(false)
    setReconnecting(false)
    setAttemptsExhausted(false)
    setRunInfo(null)
    setPhase(null)
    setCost(null)
    attemptRef.current = 0
    ptyBufferRef.current = []
    // Don't reset terminalWriteRef — TerminalPane registers it separately per mount

    connect()

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      if (wsRef.current) {
        // Prevent reconnect on intentional cleanup
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [runId, connect])

  return {
    connected,
    reconnecting,
    attemptsExhausted,
    retry,
    runInfo,
    phase,
    cost,
    terminalWrite,
    setTerminalWrite,
  }
}
