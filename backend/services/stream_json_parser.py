"""Parse stream-json output from Claude CLI PTY.

Handles:
  - ANSI escape sequence stripping
  - ConPTY line wrapping at column 120 (CR+LF in middle of JSON)
  - Incremental buffering across PTY chunks
"""

import json
import re

# Matches ANSI CSI sequences (\x1b[...m) and OSC sequences (\x1b]...\x07)
_ANSI_RE = re.compile(r"\x1b(?:\[[0-9;]*[A-Za-z]|\][^\x07]*\x07|[^[\]])")


def _strip_ansi(text: str) -> str:
    """Remove ANSI escape sequences from text."""
    return _ANSI_RE.sub("", text)


class StreamJsonParser:
    """Accumulates PTY bytes, strips ANSI, reassembles wrapped JSON lines, parses events.

    ConPTY (Windows Console Pseudo-Terminal) inserts CR+LF at column 120 inside
    long JSON lines.  A wrapped line is a fragment that starts with '{' but fails
    to parse — we hold it in _fragment until the next feed() provides the rest.
    """

    def __init__(self) -> None:
        # Line-level accumulation buffer (not yet terminated by LF)
        self._pending = ""
        # Current incomplete JSON fragment (may span multiple CR+LF-wrapped chunks)
        self._fragment = ""

    def feed(self, raw: str) -> list[dict]:
        """Feed decoded PTY text, return list of parsed JSON event dicts."""
        clean = _strip_ansi(raw)
        # Replace ConPTY CR+LF with a sentinel so we can detect wrap vs real newline.
        # Real newlines are just LF; ConPTY wraps are CR+LF.
        # Strategy: strip CR before LF so CR+LF becomes LF, then we handle fragments
        # by checking whether a line parses as complete JSON.
        clean = clean.replace("\r\n", "\n").replace("\r", "")
        self._pending += clean
        return self._drain()

    def _drain(self) -> list[dict]:
        """Extract and parse complete JSON lines from the internal buffer."""
        events: list[dict] = []
        while "\n" in self._pending:
            nl_pos = self._pending.index("\n")
            line = self._pending[:nl_pos].strip()
            self._pending = self._pending[nl_pos + 1 :]
            if not line:
                # Empty line — if we have a fragment, it's complete (no continuation)
                if self._fragment:
                    event = _try_loads(self._fragment)
                    if event is not None:
                        events.append(event)
                    self._fragment = ""
                continue

            if self._fragment:
                # Continuation of a ConPTY-wrapped JSON line
                candidate = self._fragment + line
                event = _try_loads(candidate)
                if event is not None:
                    events.append(event)
                    self._fragment = ""
                else:
                    self._fragment = candidate
            elif line.startswith("{"):
                event = _try_loads(line)
                if event is not None:
                    events.append(event)
                else:
                    # Incomplete JSON — store as fragment, await continuation
                    self._fragment = line
            # Lines not starting with '{' are non-JSON (plain text output); skip them
        return events


def _try_loads(text: str) -> dict | None:
    """Attempt json.loads; return None on failure without side effects."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None
