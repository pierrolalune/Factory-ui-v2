"""GitHub integration router — push branches, manage pull requests."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.services import github_service
from backend.services.project_service import get_project

router = APIRouter()
logger = logging.getLogger("factory")


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------


class PushRequest(BaseModel):
    branch: str
    worktree_path: str | None = None
    force: bool = False


class PullRequestCreate(BaseModel):
    head_branch: str
    base_branch: str
    title: str
    body: str = ""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/github/remote")
async def get_remote_info(project_id: str) -> dict:
    """Return the GitHub remote owner/repo/default_branch for a project."""
    project = _get_project_or_404(project_id)
    try:
        return github_service.get_remote_info(project.path)
    except ValueError as exc:
        _raise_github_error(exc)


@router.post("/projects/{project_id}/github/push")
async def push_branch(project_id: str, body: PushRequest) -> dict:
    """Push a branch to GitHub origin."""
    project = _get_project_or_404(project_id)
    try:
        return github_service.push_branch(
            project.path,
            body.branch,
            body.worktree_path,
            body.force,
        )
    except ValueError as exc:
        _raise_github_error(exc)


@router.post("/projects/{project_id}/github/pull-request")
async def create_pull_request(project_id: str, body: PullRequestCreate) -> dict:
    """Create a GitHub pull request for a project branch."""
    project = _get_project_or_404(project_id)
    try:
        return github_service.create_pull_request(
            project.path,
            body.head_branch,
            body.base_branch,
            body.title,
            body.body,
        )
    except ValueError as exc:
        _raise_github_error(exc)


@router.get("/projects/{project_id}/github/pull-requests")
async def list_pull_requests(project_id: str, branch: str | None = None) -> list:
    """List open GitHub pull requests for a project."""
    project = _get_project_or_404(project_id)
    try:
        return github_service.list_pull_requests(project.path, branch=branch)
    except ValueError as exc:
        _raise_github_error(exc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_project_or_404(project_id: str):
    """Return project or raise 404."""
    project = get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _raise_github_error(exc: ValueError) -> None:
    """Map service ValueError codes to HTTP responses."""
    code = str(exc)
    status_map = {
        "no_token": (400, "No GitHub token configured"),
        "no_remote": (400, "No git remote origin configured"),
        "no_remote_configured": (400, "No GitHub remote configured"),
        "not_github": (400, "Remote is not a GitHub URL"),
        "push_rejected": (400, "Push rejected — branch has diverged. Use force push."),
        "branch_not_pushed": (400, "Head branch not found on GitHub — push it first"),
    }
    if code in status_map:
        status, detail = status_map[code]
        raise HTTPException(status_code=status, detail=detail, headers={"X-Error-Code": code})
    raise HTTPException(status_code=500, detail=f"GitHub error: {code}")
