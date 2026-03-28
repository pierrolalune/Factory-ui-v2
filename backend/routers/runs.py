"""Runs router — list and inspect past runs, terminal output replay."""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from backend.schemas.run import Run, RunSummary
from backend.services import run_history_service, run_output_service

router = APIRouter()
logger = logging.getLogger("factory")

PROJECTS_DIR = Path.home() / ".factory-projects"


@router.get("", response_model=list[RunSummary])
async def list_runs(
    project_id: str | None = Query(None, description="Filter by project ID"),
    status: str | None = Query(None, description="Filter by status"),
    limit: int | None = Query(None, ge=1, description="Maximum number of results"),
    sort: str | None = Query(None, description="Sort order, e.g. started_at_desc"),
) -> list[RunSummary]:
    """List runs across all projects or filtered by project/status."""
    return run_history_service.list_runs(
        project_id=project_id,
        status=status,
        limit=limit,
        sort=sort,
    )


@router.get("/{run_id}", response_model=Run)
async def get_run(run_id: str) -> Run:
    """Get the full details of a single run by ID."""
    run = _find_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/{run_id}/output")
async def get_run_output(run_id: str) -> dict:
    """Return the stored PTY output for a completed run as base64-encoded bytes.

    The client decodes the base64 string and writes raw bytes into xterm.js for replay.
    Returns empty string when no output has been saved.
    """
    run = _find_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    output_b64 = run_output_service.get_output(run_id, run.project_id)
    return {"data": output_b64}


@router.delete("/{run_id}")
async def delete_run(run_id: str) -> dict:
    """Delete a run record and its associated output file."""
    run = _find_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    _delete_run_files(run_id, run.project_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _find_run(run_id: str) -> Run | None:
    """Search all project run directories for a run by ID."""
    if not PROJECTS_DIR.exists():
        return None

    for project_dir in PROJECTS_DIR.iterdir():
        if not project_dir.is_dir():
            continue
        run_file = project_dir / "runs" / f"{run_id}.json"
        if run_file.exists():
            return _load_full_run(run_file, project_dir.name)

    return None


def _load_full_run(run_file: Path, project_id: str) -> Run | None:
    """Parse a run JSON file into a full Run model."""
    try:
        data = json.loads(run_file.read_text(encoding="utf-8"))
        data.setdefault("project_id", project_id)
        # Map run_id key if stored as "id"
        if "id" in data and "run_id" not in data:
            data["run_id"] = data["id"]
        return Run(**data)
    except Exception as exc:
        logger.warning("Failed to parse run file %s: %s", run_file, exc)
        return None


def _delete_run_files(run_id: str, project_id: str) -> None:
    """Remove the run JSON and output gz files for a given run."""
    run_dir = PROJECTS_DIR / project_id / "runs"
    for suffix in (".json", ".output.gz"):
        path = run_dir / f"{run_id}{suffix}"
        try:
            if path.exists():
                path.unlink()
        except OSError as exc:
            logger.warning("Failed to delete %s: %s", path, exc)
