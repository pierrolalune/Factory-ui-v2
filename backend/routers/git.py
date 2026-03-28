"""Git router — status, diff, stage, unstage, commit, log."""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.schemas.worktree import GitCommit, GitDiff, GitStatus
from backend.services import git_service, project_service

router = APIRouter()


def _get_project_path(project_id: str) -> str:
    """Resolve project path or raise 404."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail={"code": "project_not_found", "message": "Project not found"})
    return project.path


class StageRequest(BaseModel):
    paths: list[str]
    worktree_path: str | None = None


class CommitRequest(BaseModel):
    message: str
    worktree_path: str | None = None


@router.get("/status", response_model=GitStatus)
async def get_status(
    project_id: str,
    worktree_path: str | None = Query(default=None),
) -> GitStatus:
    project_path = _get_project_path(project_id)
    try:
        return git_service.get_status(project_path, worktree_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"code": "git_error", "message": str(exc)})


@router.get("/diff", response_model=GitDiff)
async def get_diff(
    project_id: str,
    path: str = Query(...),
    staged: bool = Query(default=False),
    worktree_path: str | None = Query(default=None),
) -> GitDiff:
    project_path = _get_project_path(project_id)
    try:
        return git_service.get_diff(project_path, path, staged, worktree_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"code": "git_error", "message": str(exc)})


@router.post("/stage")
async def stage_files(
    project_id: str,
    body: StageRequest,
) -> dict:
    project_path = _get_project_path(project_id)
    try:
        git_service.stage_files(project_path, body.paths, body.worktree_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"code": "git_error", "message": str(exc)})
    return {"ok": True}


@router.post("/unstage")
async def unstage_files(
    project_id: str,
    body: StageRequest,
) -> dict:
    project_path = _get_project_path(project_id)
    try:
        git_service.unstage_files(project_path, body.paths, body.worktree_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"code": "git_error", "message": str(exc)})
    return {"ok": True}


@router.post("/discard")
async def discard_files(
    project_id: str,
    body: StageRequest,
) -> dict:
    project_path = _get_project_path(project_id)
    try:
        git_service.discard_files(project_path, body.paths, body.worktree_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"code": "git_error", "message": str(exc)})
    return {"ok": True}


@router.post("/commit")
async def commit(
    project_id: str,
    body: CommitRequest,
) -> dict:
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail={"code": "empty_message", "message": "Commit message is required"})

    project_path = _get_project_path(project_id)
    try:
        return git_service.commit(project_path, body.message.strip(), body.worktree_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": str(exc), "message": "Nothing staged to commit"})
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"code": "git_error", "message": str(exc)})


@router.get("/log", response_model=list[GitCommit])
async def get_log(
    project_id: str,
    limit: int = Query(default=10, ge=1, le=100),
    worktree_path: str | None = Query(default=None),
) -> list[GitCommit]:
    project_path = _get_project_path(project_id)
    try:
        return git_service.get_log(project_path, limit, worktree_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail={"code": "git_error", "message": str(exc)})
