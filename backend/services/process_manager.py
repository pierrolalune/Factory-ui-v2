"""Core process manager — PTY lifecycle, run state, WebSocket broadcast.

Each run is represented as a plain dict stored in memory and persisted to
~/.factory-projects/{project_id}/runs/{run_id}.json.

PTY read loops run in daemon threads; WebSocket subscribers receive base64-
encoded PTY output plus structured status/phase/cost events.
"""

import base64
import json
import logging
import secrets
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.services.prompt_detector import PromptDetector
from backend.services.stream_json_parser import StreamJsonParser

logger = logging.getLogger("factory")

PROJECTS_DIR = Path.home() / ".factory-projects"
_OUTPUT_BUFFER_MAX = 512_000  # 500 KB


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _run_path(project_id: str, run_id: str) -> Path:
    return PROJECTS_DIR / project_id / "runs" / f"{run_id}.json"


class ProcessManager:
    """Singleton that owns all active PTY processes and run state."""

    def __init__(self) -> None:
        self._runs: dict[str, dict] = {}
        self._processes: dict[str, Any] = {}
        self._ws_subscribers: dict[str, list] = {}
        self._output_buffers: dict[str, bytearray] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Startup / shutdown
    # ------------------------------------------------------------------

    def recover_interrupted_runs(self) -> None:
        """Mark any active/pending runs on disk as failed after unclean shutdown."""
        if not PROJECTS_DIR.exists():
            return
        for project_dir in PROJECTS_DIR.iterdir():
            if not project_dir.is_dir():
                continue
            run_dir = project_dir / "runs"
            if not run_dir.exists():
                continue
            for run_file in run_dir.glob("*.json"):
                self._maybe_mark_interrupted(run_file)

    def _maybe_mark_interrupted(self, run_file: Path) -> None:
        """Mark a single run file as failed if it was left active."""
        try:
            data = json.loads(run_file.read_text(encoding="utf-8"))
            if data.get("status") in ("active", "pending", "awaiting_input"):
                data["status"] = "failed"
                data["error_message"] = "Interrupted: server restarted"
                run_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to recover run file %s: %s", run_file, exc)

    def terminate_all(self) -> None:
        """Kill all active PTY processes on shutdown."""
        with self._lock:
            for run_id in list(self._processes.keys()):
                self._kill_process(run_id)

    def _kill_process(self, run_id: str) -> None:
        """Terminate a PTY process. Must be called under self._lock."""
        proc = self._processes.pop(run_id, None)
        if proc is None:
            return
        try:
            proc.terminate()
        except Exception as exc:
            logger.debug("Error terminating process %s: %s", run_id, exc)

    # ------------------------------------------------------------------
    # Run registration
    # ------------------------------------------------------------------

    def register_run(self, run_data: dict) -> str:
        """Persist a new run record and return its run_id."""
        run_id = run_data["run_id"]
        with self._lock:
            self._runs[run_id] = run_data
            self._output_buffers[run_id] = bytearray()
        self._persist_run(run_data)
        return run_id

    def _persist_run(self, run_data: dict) -> None:
        """Write run state to disk."""
        run_id = run_data["run_id"]
        project_id = run_data.get("project_id", "unknown")
        path = _run_path(project_id, run_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            path.write_text(json.dumps(run_data, indent=2), encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to persist run %s: %s", run_id, exc)

    # ------------------------------------------------------------------
    # Run state access
    # ------------------------------------------------------------------

    def get_run(self, run_id: str) -> dict | None:
        """Return run state from memory; fall back to disk if not loaded."""
        with self._lock:
            if run_id in self._runs:
                return dict(self._runs[run_id])

        # Try all known project directories
        if PROJECTS_DIR.exists():
            for project_dir in PROJECTS_DIR.iterdir():
                run_file = project_dir / "runs" / f"{run_id}.json"
                if run_file.exists():
                    try:
                        return json.loads(run_file.read_text(encoding="utf-8"))
                    except Exception:
                        return None
        return None

    def _update_run(self, run_id: str, updates: dict) -> None:
        """Apply updates to in-memory run state and persist."""
        with self._lock:
            if run_id not in self._runs:
                return
            self._runs[run_id].update(updates)
            run_data = dict(self._runs[run_id])
        self._persist_run(run_data)

    # ------------------------------------------------------------------
    # PTY spawn
    # ------------------------------------------------------------------

    def spawn_command_run(self, run_id: str) -> None:
        """Spawn claude --print --output-format stream-json in a PTY thread."""
        run = self.get_run(run_id)
        if run is None:
            return
        cmd = self._build_command_args(run)
        cwd = run.get("worktree_path") or run.get("project_path", ".")
        thread = threading.Thread(
            target=self._pty_read_loop,
            args=(run_id, cmd, cwd),
            daemon=True,
        )
        thread.start()

    def spawn_raw_run(self, run_id: str) -> None:
        """Spawn interactive claude (no --print) in a PTY thread."""
        run = self.get_run(run_id)
        if run is None:
            return
        cmd = ["claude"]
        if run.get("skip_permissions"):
            cmd.append("--dangerously-skip-permissions")
        cwd = run.get("worktree_path") or run.get("project_path", ".")
        thread = threading.Thread(
            target=self._pty_read_loop,
            args=(run_id, cmd, cwd),
            daemon=True,
        )
        thread.start()

    def _build_command_args(self, run: dict) -> list[str]:
        """Construct the claude CLI argument list for a command run."""
        cmd = ["claude", "--print", "--output-format", "stream-json", "--verbose"]
        if run.get("skip_permissions"):
            cmd.append("--dangerously-skip-permissions")
        if run.get("type") == "resume" and run.get("claude_session_id"):
            cmd += ["--resume", run["claude_session_id"]]
        prompt = run.get("prompt", "")
        if prompt:
            cmd.append(prompt)
        return cmd

    def _pty_read_loop(self, run_id: str, cmd: list[str], cwd: str) -> None:
        """Background thread: read PTY bytes, broadcast to WS, parse events."""
        self._update_run(run_id, {"status": "active", "started_at": _now_iso()})
        self._broadcast(run_id, {"type": "status_update", "status": "active"})

        try:
            import winpty  # pywinpty — Windows ConPTY

            pty = winpty.PtyProcess.spawn(cmd, cwd=cwd, dimensions=(40, 120))
        except FileNotFoundError:
            self._fail_run_no_cli(run_id)
            return
        except Exception as exc:
            self._update_run(run_id, {"status": "failed", "error_message": str(exc)[:500]})
            self._broadcast(run_id, {"type": "status_update", "status": "failed"})
            return

        with self._lock:
            self._processes[run_id] = pty

        parser = StreamJsonParser()
        detector = PromptDetector()

        try:
            self._read_pty(run_id, pty, parser, detector)
        finally:
            exit_code = self._finalize_pty(run_id, pty)
            with self._lock:
                self._processes.pop(run_id, None)
            self._resolve_run_status(run_id, exit_code)

    def _read_pty(self, run_id: str, pty: Any, parser: StreamJsonParser, detector: PromptDetector) -> None:
        """Inner read loop: drain bytes from pty until EOF."""
        while True:
            try:
                raw = pty.read(4096)
            except EOFError:
                break
            except Exception:
                break
            if not raw:
                break
            self._buffer_output(run_id, raw)
            self._broadcast(run_id, {"type": "pty_output", "data": base64.b64encode(raw).decode()})

            text = raw.decode("utf-8", errors="replace")
            self._process_stream_events(run_id, text, parser)
            self._process_prompt_detection(run_id, text, detector)

    def _buffer_output(self, run_id: str, data: bytes) -> None:
        """Append to output buffer, capping at 500 KB by trimming from front."""
        with self._lock:
            buf = self._output_buffers.get(run_id)
            if buf is None:
                return
            buf.extend(data)
            if len(buf) > _OUTPUT_BUFFER_MAX:
                del buf[: len(buf) - _OUTPUT_BUFFER_MAX]

    def _process_stream_events(self, run_id: str, text: str, parser: StreamJsonParser) -> None:
        """Parse stream-json events and emit phase/cost WS messages."""
        for event in parser.feed(text):
            self._handle_stream_event(run_id, event)

    def _handle_stream_event(self, run_id: str, event: dict) -> None:
        """Dispatch a parsed stream-json event to the appropriate handler."""
        ev_type = event.get("type")
        if ev_type == "system" and event.get("subtype") == "init":
            session_id = event.get("session_id")
            if session_id:
                self._update_run(run_id, {"claude_session_id": session_id})
        elif ev_type == "assistant":
            self._handle_assistant_event(run_id, event)
        elif ev_type == "result":
            self._handle_result_event(run_id, event)

    def _handle_assistant_event(self, run_id: str, event: dict) -> None:
        """Emit phase_update from an assistant stream-json event."""
        message = event.get("message", {})
        content = message.get("content", [])
        for block in content:
            if block.get("type") == "tool_use":
                tool_name = block.get("name", "")
                file_path = block.get("input", {}).get("file_path")
                self._broadcast(
                    run_id,
                    {"type": "phase_update", "phase": "tool_use", "tool_name": tool_name, "file_path": file_path},
                )
                return
            if block.get("type") == "text":
                self._broadcast(run_id, {"type": "phase_update", "phase": "text"})
                return

    def _handle_result_event(self, run_id: str, event: dict) -> None:
        """Update cost/token fields from a result stream-json event."""
        updates = {}
        if "cost_usd" in event:
            updates["total_cost_usd"] = event["cost_usd"]
        if "num_turns" in event:
            updates["num_turns"] = event["num_turns"]
        if "input_tokens" in event:
            updates["input_tokens"] = event["input_tokens"]
        if "output_tokens" in event:
            updates["output_tokens"] = event["output_tokens"]
        if updates:
            self._update_run(run_id, updates)
        self._broadcast(
            run_id,
            {
                "type": "cost_update",
                "cost_usd": event.get("cost_usd"),
                "input_tokens": event.get("input_tokens"),
                "output_tokens": event.get("output_tokens"),
                "num_turns": event.get("num_turns"),
            },
        )

    def _process_prompt_detection(self, run_id: str, text: str, detector: PromptDetector) -> None:
        """Run PromptDetector and emit awaiting_input_update if state changed."""
        transition = detector.feed(text)
        if transition == "awaiting_input":
            self._update_run(run_id, {"status": "awaiting_input", "awaiting_input": True})
            self._broadcast(run_id, {"type": "awaiting_input_update", "awaiting_input": True})
        elif transition == "active":
            self._update_run(run_id, {"status": "active", "awaiting_input": False})
            self._broadcast(run_id, {"type": "awaiting_input_update", "awaiting_input": False})

    def _finalize_pty(self, run_id: str, pty: Any) -> int | None:
        """Wait for PTY to exit and return its exit code."""
        try:
            pty.wait()
            return pty.exitstatus
        except Exception:
            return None

    def _resolve_run_status(self, run_id: str, exit_code: int | None) -> None:
        """Set final run status based on exit code and current run state."""
        run = self.get_run(run_id)
        if run is None:
            return
        current_status = run.get("status", "")
        if current_status == "cancelled":
            return  # already handled by cancel_run

        ended_at = _now_iso()
        started_at = run.get("started_at")
        duration_ms = None
        if started_at:
            try:
                from datetime import datetime

                start = datetime.fromisoformat(started_at)
                end = datetime.fromisoformat(ended_at)
                duration_ms = (end - start).total_seconds() * 1000
            except Exception:
                pass

        status = "completed" if exit_code == 0 else "failed"
        self._update_run(
            run_id,
            {"status": status, "exit_code": exit_code, "ended_at": ended_at, "duration_ms": duration_ms},
        )
        self._broadcast(run_id, {"type": "status_update", "status": status, "exit_code": exit_code})

    def _fail_run_no_cli(self, run_id: str) -> None:
        """Mark run as failed because claude binary was not found on PATH."""
        msg = "Claude CLI not found. Make sure claude is installed and on PATH."
        self._update_run(run_id, {"status": "failed", "error_message": msg})
        self._broadcast(run_id, {"type": "status_update", "status": "failed"})

    # ------------------------------------------------------------------
    # Cancel
    # ------------------------------------------------------------------

    def cancel_run(self, run_id: str) -> bool:
        """Send terminate signal to the PTY process. Returns False if not found."""
        with self._lock:
            if run_id not in self._runs:
                return False
            self._kill_process(run_id)
            self._runs[run_id]["status"] = "cancelled"
            run_data = dict(self._runs[run_id])

        self._persist_run(run_data)
        self._broadcast(run_id, {"type": "status_update", "status": "cancelled"})
        return True

    # ------------------------------------------------------------------
    # WebSocket subscriber management
    # ------------------------------------------------------------------

    def subscribe_ws(self, run_id: str, ws: Any) -> None:
        """Add a WebSocket subscriber to receive run events."""
        with self._lock:
            if run_id not in self._ws_subscribers:
                self._ws_subscribers[run_id] = []
            self._ws_subscribers[run_id].append(ws)

    def unsubscribe_ws(self, run_id: str, ws: Any) -> None:
        """Remove a WebSocket subscriber."""
        with self._lock:
            subs = self._ws_subscribers.get(run_id, [])
            try:
                subs.remove(ws)
            except ValueError:
                pass

    def get_output_buffer(self, run_id: str) -> bytes:
        """Return the last ~500 KB of PTY output for replay on WS reconnect."""
        with self._lock:
            buf = self._output_buffers.get(run_id, bytearray())
            return bytes(buf)

    def _broadcast(self, run_id: str, message: dict) -> None:
        """Send a JSON message to all WebSocket subscribers for this run."""
        with self._lock:
            subscribers = list(self._ws_subscribers.get(run_id, []))
        payload = json.dumps(message)
        for ws in subscribers:
            try:
                import asyncio

                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.run_coroutine_threadsafe(ws.send_text(payload), loop)
            except Exception as exc:
                logger.debug("WS broadcast error for %s: %s", run_id, exc)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def count_active_runs_for_worktree(self, worktree_path: str | None, project_id: str) -> int:
        """Count active runs targeting a specific worktree (or project root)."""
        target = worktree_path
        with self._lock:
            count = 0
            for run in self._runs.values():
                if run.get("project_id") != project_id:
                    continue
                if run.get("status") not in ("active", "pending", "awaiting_input"):
                    continue
                run_target = run.get("worktree_path") or run.get("project_path")
                if run_target == target or (target is None and run.get("worktree_path") is None):
                    count += 1
            return count


def _make_run_id(prefix: str, stem: str = "") -> str:
    """Generate a unique run ID with the given prefix."""
    suffix = secrets.token_hex(4)
    if stem:
        slug = stem.replace("/", "-").replace("\\", "-")[:20]
        return f"{prefix}-{slug}-{suffix}"
    return f"{prefix}-{suffix}"


process_manager = ProcessManager()
