"""Worktrees router — CRUD for git worktrees."""

import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from backend.schemas.worktree import Worktree, WorktreeCreate
from backend.services import project_service, worktree_service

router = APIRouter()


def _get_project_or_404(project_id: str):
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail={"code": "project_not_found", "message": "Project not found"})
    return project


@router.get("", response_model=list[Worktree])
async def list_worktrees(project_id: str) -> list[Worktree]:
    _get_project_or_404(project_id)
    return worktree_service.list_worktrees(project_id)


@router.post("")
async def create_worktree(project_id: str, body: WorktreeCreate) -> dict:
    _get_project_or_404(project_id)
    try:
        return worktree_service.create_worktree(project_id, body)
    except ValueError as exc:
        code = str(exc)
        msg_map = {
            "invalid_branch_name": "Invalid git branch name",
            "branch_exists": f"Branch '{body.branch}' already exists",
            "branch_not_found": f"Branch '{body.branch}' does not exist",
        }
        raise HTTPException(status_code=400, detail={"code": code, "message": msg_map.get(code, code)})
    except OSError:
        raise HTTPException(status_code=500, detail={"code": "disk_full", "message": "Not enough disk space to create worktree."})
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"code": "git_error", "message": str(exc)})


@router.delete("/{wt_id}")
async def delete_worktree(
    project_id: str,
    wt_id: str,
    delete_branch: bool = Query(default=False),
) -> dict:
    _get_project_or_404(project_id)
    try:
        worktree_service.delete_worktree(project_id, wt_id, delete_branch)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail={"code": str(exc), "message": "Worktree not found"})
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"code": "git_error", "message": str(exc)})
    return {"ok": True}


@router.get("/{wt_id}", response_model=Worktree)
async def get_worktree(project_id: str, wt_id: str) -> Worktree:
    _get_project_or_404(project_id)
    wt = worktree_service.get_worktree(project_id, wt_id)
    if wt is None:
        raise HTTPException(status_code=404, detail={"code": "worktree_not_found", "message": "Worktree not found"})
    return wt


@router.get("/branches/list")
async def list_branches(project_id: str) -> dict:
    """List local and remote branches for the project."""
    project = _get_project_or_404(project_id)
    cwd = Path(project.path)

    r = subprocess.run(
        ["git", "branch", "--format=%(refname:short)"],
        cwd=cwd, capture_output=True, text=True,
    )
    local = [b.strip() for b in r.stdout.splitlines() if b.strip()]

    r2 = subprocess.run(
        ["git", "branch", "-r", "--format=%(refname:short)"],
        cwd=cwd, capture_output=True, text=True,
    )
    remote = [b.strip() for b in r2.stdout.splitlines() if b.strip()]

    r3 = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=cwd, capture_output=True, text=True,
    )
    current = r3.stdout.strip() if r3.returncode == 0 else "main"

    return {"current": current, "local": local, "remote": remote}
