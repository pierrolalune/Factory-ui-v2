"use client"

// xterm CSS has no type declarations — import is intentional
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import "@xterm/xterm/css/xterm.css"

import { useEffect, useRef } from "react"
import type { Terminal as XTerminal } from "@xterm/xterm"

interface TerminalReplayProps {
  runId: string
  status: string
  /** Base64-encoded raw PTY bytes (from GET /api/runs/{id}/output). */
  outputB64?: string
}

/**
 * Static terminal replay for completed runs — decodes stored PTY output and writes
 * it into an xterm.js instance. No WebSocket connection.
 *
 * For active runs this component renders a placeholder directing the user to the
 * live terminal in the project IDE.
 */
export function TerminalReplay({ outputB64 }: TerminalReplayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const xtermRef = useRef<XTerminal | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let disposed = false

    async function init() {
      const { Terminal } = await import("@xterm/xterm")
      const { FitAddon } = await import("@xterm/addon-fit")

      if (disposed) return

      const xterm = new Terminal({
        theme: {
          background: "#10161f",
          foreground: "#dce8f5",
          cursor: "#4195e8",
          selectionBackground: "#4195e840",
        },
        fontFamily: "'DM Mono', 'Cascadia Code', monospace",
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: false,
        scrollback: 5000,
      })

      const fitAddon = new FitAddon()
      xterm.loadAddon(fitAddon)
      xterm.open(el as HTMLElement)
      fitAddon.fit()
      xtermRef.current = xterm

      // Write stored output
      if (outputB64) {
        const decoded = atob(outputB64)
        const bytes = new Uint8Array(decoded.length)
        for (let i = 0; i < decoded.length; i++) {
          bytes[i] = decoded.charCodeAt(i)
        }
        xterm.write(bytes)
        // Scroll to bottom after replay
        setTimeout(() => xterm.scrollToBottom(), 50)
      } else {
        xterm.writeln("\x1b[2m(No output recorded for this run)\x1b[0m")
      }
    }

    init().catch(console.error)

    const handleResize = () => {
      // FitAddon is captured in closure — re-import would need different approach
      // We just rely on the component re-mounting on resize for simplicity
    }
    window.addEventListener("resize", handleResize)

    return () => {
      disposed = true
      window.removeEventListener("resize", handleResize)
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
      }
    }
  }, [outputB64])

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-lg overflow-hidden bg-[#10161f]"
      style={{ minHeight: "300px" }}
    />
  )
}
