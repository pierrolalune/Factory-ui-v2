"""Worktree service — git worktree management + metadata persistence."""

import json
import logging
import re
import secrets
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from backend.schemas.worktree import Worktree, WorktreeCreate
from backend.services import project_service

logger = logging.getLogger("factory")

# Patched in tests
PROJECTS_DIR: Path = Path.home() / ".factory-projects"


def _worktrees_file(project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "worktrees.json"


def _load(project_id: str) -> list[dict]:
    f = _worktrees_file(project_id)
    if not f.exists():
        return []
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to parse worktrees.json for %s: %s", project_id, exc)
        return []


def _save(project_id: str, data: list[dict]) -> None:
    f = _worktrees_file(project_id)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _branch_slug(branch: str) -> str:
    """Convert branch name to filesystem-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", branch.lower()).strip("-")[:50]


def _make_id(branch: str) -> str:
    slug = _branch_slug(branch)
    return f"wt-{slug}-{secrets.token_hex(3)}"


def _run(args: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True)


def _get_git_status_for_worktree(wt_path: Path) -> tuple[bool, int, str | None]:
    """Return (is_dirty, ahead, commit_sha) for a worktree path."""
    if not wt_path.exists():
        return False, 0, None

    # Get dirty status
    r = subprocess.run(
        ["git", "status", "--porcelain"], cwd=wt_path, capture_output=True, text=True
    )
    is_dirty = bool(r.stdout.strip())

    # Get ahead count relative to base branch
    ahead = 0
    r2 = subprocess.run(
        ["git", "rev-list", "--left-right", "--count", "HEAD...@{u}"],
        cwd=wt_path, capture_output=True, text=True,
    )
    if r2.returncode == 0:
        parts = r2.stdout.strip().split()
        if len(parts) == 2:
            ahead = int(parts[0])

    # Get short sha
    r3 = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], cwd=wt_path, capture_output=True, text=True
    )
    commit_sha = r3.stdout.strip() if r3.returncode == 0 else None

    return is_dirty, ahead, commit_sha


def list_worktrees(project_id: str) -> list[Worktree]:
    """List all worktrees, refreshing dirty/ahead status from git."""
    rows = _load(project_id)
    result: list[Worktree] = []
    updated = False

    for row in rows:
        wt_path = Path(row["path"])
        is_dirty, ahead, commit_sha = _get_git_status_for_worktree(wt_path)

        row["is_dirty"] = is_dirty
        row["ahead"] = ahead
        row["commit_sha"] = commit_sha
        updated = True
        result.append(Worktree(**row))

    if updated:
        _save(project_id, rows)

    return result


def get_worktree(project_id: str, worktree_id: str) -> Worktree | None:
    """Return a single worktree by id."""
    for row in _load(project_id):
        if row["id"] == worktree_id:
            return Worktree(**row)
    return None


def _worktree_path(project_path: str, branch: str) -> Path:
    """Compute the filesystem path for a new worktree."""
    project = Path(project_path)
    slug = _branch_slug(branch)
    return project.parent / f"{project.name}-worktrees" / slug


def _validate_branch_name(branch: str) -> bool:
    """Basic git branch name validation."""
    if not branch:
        return False
    if " " in branch or ".." in branch:
        return False
    # Must not start or end with /
    if branch.startswith("/") or branch.endswith("/"):
        return False
    return True


def create_worktree(project_id: str, data: WorktreeCreate) -> dict:
    """Create a new git worktree and register it."""
    if not _validate_branch_name(data.branch):
        raise ValueError("invalid_branch_name")

    project = project_service.get_project(project_id)
    if project is None:
        raise FileNotFoundError("project_not_found")

    project_path = project.path
    cwd = Path(project_path)
    wt_path = _worktree_path(project_path, data.branch)

    if data.create_branch:
        r = _run(
            ["git", "worktree", "add", "-b", data.branch, str(wt_path), data.base_branch],
            cwd,
        )
        if r.returncode != 0:
            stderr = r.stderr.lower()
            if "already exists" in stderr or "branch" in stderr and "exists" in stderr:
                raise ValueError("branch_exists")
            if "enospc" in stderr or "no space" in stderr:
                raise OSError("disk_full")
            raise RuntimeError(r.stderr.strip() or "git worktree add failed")
    else:
        r = _run(["git", "worktree", "add", str(wt_path), data.branch], cwd)
        if r.returncode != 0:
            stderr = r.stderr.lower()
            if "not a valid branch" in stderr or "pathspec" in stderr:
                raise ValueError("branch_not_found")
            if "enospc" in stderr or "no space" in stderr:
                raise OSError("disk_full")
            raise RuntimeError(r.stderr.strip() or "git worktree add failed")

    wt_id = _make_id(data.branch)
    row = {
        "id": wt_id,
        "project_id": project_id,
        "branch": data.branch,
        "path": str(wt_path),
        "base_branch": data.base_branch,
        "created_at": _now_iso(),
        "is_dirty": False,
        "ahead": 0,
        "commit_sha": None,
    }
    rows = _load(project_id)
    rows.append(row)
    _save(project_id, rows)

    return {"id": wt_id, "path": str(wt_path)}


def delete_worktree(project_id: str, worktree_id: str, delete_branch: bool = False) -> None:
    """Remove a worktree (and optionally its branch)."""
    rows = _load(project_id)
    row = next((r for r in rows if r["id"] == worktree_id), None)
    if row is None:
        raise FileNotFoundError("worktree_not_found")

    project = project_service.get_project(project_id)
    if project is None:
        raise FileNotFoundError("project_not_found")

    cwd = Path(project.path)
    wt_path = row["path"]

    r = _run(["git", "worktree", "remove", wt_path, "--force"], cwd)
    if r.returncode != 0:
        logger.warning("git worktree remove failed: %s", r.stderr)

    if delete_branch:
        _run(["git", "branch", "-D", row["branch"]], cwd)

    new_rows = [r for r in rows if r["id"] != worktree_id]
    _save(project_id, new_rows)
