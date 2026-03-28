"""Run router — launch, cancel, and retrieve run state.

Endpoints (all prefixed /api/run in main.py):
  POST /command         — launch a slash command
  POST /raw             — launch interactive session
  POST /resume          — resume a past Claude session
  POST /{run_id}/cancel — cancel an active run
  GET  /{run_id}        — get current run state

Separate commands_router (prefixed /api in main.py):
  GET  /projects/{project_id}/commands — scan .claude/ for commands
"""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from backend.schemas.run import CommandInfo, RawRunCreate, ResumeRunCreate, Run, RunCreate
from backend.services import claude_folder_scanner, project_service
from backend.services.process_manager import _make_run_id, process_manager

try:
    from backend.services.worktree_service import get_worktree as _get_worktree
except (ImportError, AttributeError):
    _get_worktree = None  # type: ignore[assignment]

router = APIRouter()

# Separate router so it can be mounted at /api (not /api/run)
commands_router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Command discovery — mounted at /api via commands_router
# ---------------------------------------------------------------------------


@commands_router.get("/projects/{project_id}/commands", response_model=list[CommandInfo])
async def get_project_commands(project_id: str) -> list[CommandInfo]:
    """Scan project's .claude/ directory and return available slash commands."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail={"detail": "project not found", "code": "project_not_found"})
    return claude_folder_scanner.scan_commands(project.path)


# ---------------------------------------------------------------------------
# Launch endpoints
# ---------------------------------------------------------------------------


@router.post("/command")
async def launch_command(body: RunCreate) -> dict:
    """Launch a slash command run. Validates that the command exists on disk."""
    project = project_service.get_project(body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail={"detail": "project not found", "code": "project_not_found"})

    commands = claude_folder_scanner.scan_commands(project.path)
    stems = {c.stem for c in commands}
    if body.stem not in stems:
        raise HTTPException(
            status_code=400, detail={"detail": f"command '{body.stem}' not found", "code": "command_not_found"}
        )

    worktree_path = _resolve_worktree_path(body.worktree_id, body.project_id)
    run_id = _make_run_id("cmd", body.stem)
    prompt = f"/{body.stem}"
    if body.args:
        prompt = f"{prompt} {body.args}"

    run_data = {
        "run_id": run_id,
        "type": "command",
        "status": "pending",
        "project_id": body.project_id,
        "project_name": project.name,
        "project_path": project.path,
        "worktree_path": worktree_path,
        "command_stem": body.stem,
        "command_args": body.args or None,
        "prompt": prompt,
        "effort": body.effort,
        "skip_permissions": body.skip_permissions,
        "started_at": _now_iso(),
        "awaiting_input": False,
    }

    process_manager.register_run(run_data)

    active_count = process_manager.count_active_runs_for_worktree(worktree_path, body.project_id)
    process_manager.spawn_command_run(run_id)

    response: dict = {"run_id": run_id}
    if active_count >= 3:
        response["warning"] = "concurrent_runs_high"
        response["warning_message"] = f"{active_count} runs are already active on this worktree."
    return response


@router.post("/raw")
async def launch_raw(body: RawRunCreate) -> dict:
    """Launch an interactive raw Claude session (no --print, no stream-json)."""
    project = project_service.get_project(body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail={"detail": "project not found", "code": "project_not_found"})

    worktree_path = _resolve_worktree_path(body.worktree_id, body.project_id)
    run_id = _make_run_id("raw")

    run_data = {
        "run_id": run_id,
        "type": "raw",
        "status": "pending",
        "project_id": body.project_id,
        "project_name": project.name,
        "project_path": project.path,
        "worktree_path": worktree_path,
        "prompt": "",
        "skip_permissions": body.skip_permissions,
        "started_at": _now_iso(),
        "awaiting_input": False,
    }

    process_manager.register_run(run_data)
    process_manager.spawn_raw_run(run_id)
    return {"run_id": run_id}


@router.post("/resume")
async def resume_run(body: ResumeRunCreate) -> dict:
    """Resume a past Claude session using --resume <session_id>."""
    project = project_service.get_project(body.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail={"detail": "project not found", "code": "project_not_found"})

    worktree_path = _resolve_worktree_path(body.worktree_id, body.project_id)
    run_id = _make_run_id("rs")

    run_data = {
        "run_id": run_id,
        "type": "resume",
        "status": "pending",
        "project_id": body.project_id,
        "project_name": project.name,
        "project_path": project.path,
        "worktree_path": worktree_path,
        "claude_session_id": body.session_id,
        "prompt": f"--resume {body.session_id}",
        "skip_permissions": False,
        "started_at": _now_iso(),
        "awaiting_input": False,
    }

    process_manager.register_run(run_data)
    process_manager.spawn_command_run(run_id)
    return {"run_id": run_id}


# ---------------------------------------------------------------------------
# Cancel / status
# ---------------------------------------------------------------------------


@router.post("/{run_id}/cancel")
async def cancel_run(run_id: str) -> dict:
    """Send SIGTERM to an active run's PTY process."""
    ok = process_manager.cancel_run(run_id)
    if not ok:
        raise HTTPException(status_code=404, detail={"detail": "run not found", "code": "run_not_found"})
    return {"ok": True}


@router.get("/{run_id}", response_model=Run)
async def get_run(run_id: str) -> dict:
    """Return current run state from memory or disk."""
    run = process_manager.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail={"detail": "run not found", "code": "run_not_found"})
    return run


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_worktree_path(worktree_id: str | None, project_id: str) -> str | None:
    """Resolve a worktree_id to its filesystem path, or None for project root."""
    if worktree_id is None:
        return None
    if _get_worktree is None:
        return None
    try:
        wt = _get_worktree(project_id, worktree_id)
        return wt.path if wt else None
    except Exception:
        return None
