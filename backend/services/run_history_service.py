"""Run history service — reads run records from per-project storage directories.

Runs are stored as {run_id}.json files under ~/.factory-projects/{project_id}/runs/.
This service provides read access to the run history without mutation (runs are written
by the process manager during execution).
"""

import json
import logging
from pathlib import Path

from backend.schemas.run import RunSummary

PROJECTS_DIR = Path.home() / ".factory-projects"

logger = logging.getLogger("factory")


def _run_dir(project_id: str) -> Path:
    """Return the runs directory for a given project."""
    return PROJECTS_DIR / project_id / "runs"


def _load_run(run_file: Path, project_id: str) -> RunSummary | None:
    """Parse a single run JSON file into a RunSummary. Returns None on parse error."""
    try:
        data = json.loads(run_file.read_text(encoding="utf-8"))
        data.setdefault("project_id", project_id)
        return RunSummary(**data)
    except Exception:
        logger.warning("Failed to parse run file %s", run_file)
        return None


def list_runs(
    project_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
    sort: str | None = None,
) -> list[RunSummary]:
    """List runs from disk, optionally filtered by project and status.

    Args:
        project_id: If provided, only return runs for this project.
        status:     If provided, only return runs with this status.
        limit:      Maximum number of results to return.
        sort:       Sort key; only "started_at_desc" is supported for now.

    Returns a list of RunSummary objects (may be empty when no runs exist yet).
    """
    runs: list[RunSummary] = []

    if project_id is not None:
        runs = _list_project_runs(project_id)
    else:
        runs = _list_all_runs()

    if status is not None:
        runs = [r for r in runs if r.status == status]

    if sort == "started_at_desc":
        runs = sorted(runs, key=lambda r: r.started_at or "", reverse=True)

    if limit is not None:
        runs = runs[:limit]

    return runs


def _list_project_runs(project_id: str) -> list[RunSummary]:
    """Read all run files for a single project."""
    run_dir = _run_dir(project_id)
    if not run_dir.exists():
        return []

    results: list[RunSummary] = []
    for run_file in run_dir.glob("*.json"):
        run = _load_run(run_file, project_id)
        if run is not None:
            results.append(run)
    return results


def _list_all_runs() -> list[RunSummary]:
    """Read run files for every known project directory."""
    if not PROJECTS_DIR.exists():
        return []

    results: list[RunSummary] = []
    for project_dir in PROJECTS_DIR.iterdir():
        if not project_dir.is_dir():
            continue
        project_id = project_dir.name
        results.extend(_list_project_runs(project_id))
    return results
