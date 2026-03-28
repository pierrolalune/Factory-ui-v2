"use client"

// xterm CSS has no type declarations — import is intentional
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import "@xterm/xterm/css/xterm.css"

import { useEffect, useRef, useState } from "react"
import type { Terminal as XTerminal } from "@xterm/xterm"
import { useIDEStore } from "@/store/ide-store"
import { useRunWebSocket } from "@/hooks/use-run-websocket"
import { useCancelRun } from "@/hooks/use-run-actions"
import { RunHeader } from "./RunHeader"
import { PhaseBar } from "./PhaseBar"
import { ReconnectingOverlay } from "./ReconnectingOverlay"

interface TerminalPaneProps {
  runId: string
  /** When false the pane is still mounted but hidden (display: none) for fast switching */
  visible: boolean
}

/** Real xterm.js terminal pane connected to the run WebSocket. */
export function TerminalPane({ runId, visible }: TerminalPaneProps) {
  const { showOverview } = useIDEStore()
  const ws = useRunWebSocket(runId)
  const cancelRun = useCancelRun()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const xtermRef = useRef<XTerminal | null>(null)
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)

  // Track reconnect attempt number for overlay display
  useEffect(() => {
    if (ws.reconnecting) {
      setAttemptCount((n) => n + 1)
    } else if (ws.connected) {
      setAttemptCount(0)
    }
  }, [ws.reconnecting, ws.connected])

  // Initialize xterm.js on mount
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let disposed = false

    // Lazy import to avoid SSR issues
    void Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]).then(([{ Terminal }, { FitAddon }]) => {
      if (disposed || xtermRef.current) return

      const term = new Terminal({
        cols: 120,
        rows: 40,
        fontFamily: '"DM Mono", "Cascadia Code", monospace',
        fontSize: 13,
        theme: {
          background: "#10161f",
          foreground: "#dce8f5",
          cursor: "#4195e8",
          selectionBackground: "#263245",
          black: "#10161f",
          brightBlack: "#607896",
          white: "#dce8f5",
          brightWhite: "#dce8f5",
          blue: "#4195e8",
          brightBlue: "#5aabf5",
          cyan: "#14b8a6",
          green: "#5ecf3a",
          yellow: "#f59e0b",
          red: "#f25c5c",
          magenta: "#8b5cf6",
        },
        cursorBlink: true,
        allowTransparency: false,
        scrollback: 5000,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(el)
      fitAddon.fit()

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      // Register write callback — also flushes any buffered PTY output
      ws.setTerminalWrite((data: string) => {
        if (xtermRef.current) xtermRef.current.write(data)
      })

      // Send resize message when terminal dimensions change
      const sendResize = () => {
        // WS send is managed internally via the hook — we notify via a custom event
        // The WS hook doesn't expose send directly; we use a DOM CustomEvent pattern
        const cols = term.cols
        const rows = term.rows
        el.dispatchEvent(
          new CustomEvent("terminal-resize", { detail: { cols, rows }, bubbles: true }),
        )
      }

      term.onResize(sendResize)
    })

    return () => {
      disposed = true
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]) // Re-init when runId changes (new terminal)

  // Refit on window resize
  useEffect(() => {
    const onResize = () => {
      if (fitAddonRef.current && visible) {
        try {
          fitAddonRef.current.fit()
        } catch {
          // fit() can throw if dimensions are 0
        }
      }
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [visible])

  // Re-fit when becoming visible
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      // Use a small delay to let the DOM settle after display change
      const id = setTimeout(() => {
        try {
          fitAddonRef.current?.fit()
        } catch {
          // ignore
        }
      }, 50)
      return () => clearTimeout(id)
    }
  }, [visible])

  const handleCancel = () => {
    cancelRun.mutate(runId)
  }

  const awaitingInput = ws.runInfo?.awaitingInput ?? false
  const isRaw = ws.runInfo?.type === "raw"

  return (
    <div
      className="flex flex-col h-full"
      style={{ display: visible ? "flex" : "none" }}
    >
      <RunHeader
        run={ws.runInfo}
        runId={runId}
        costUsd={ws.cost?.costUsd ?? null}
        onCancel={handleCancel}
        onClose={showOverview}
      />

      {/* Phase bar — not shown for raw terminals */}
      {!isRaw && (
        <PhaseBar phase={ws.phase} awaitingInput={awaitingInput} />
      )}

      {/* Terminal area */}
      <div className="flex-1 relative overflow-hidden bg-[#10161f]">
        <div
          ref={containerRef}
          className="absolute inset-0 p-2"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
        <ReconnectingOverlay
          reconnecting={ws.reconnecting}
          attemptsExhausted={ws.attemptsExhausted}
          attempt={attemptCount}
          onRetry={ws.retry}
        />
      </div>
    </div>
  )
}
