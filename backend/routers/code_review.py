"""Code review router — dependency graph endpoints."""

import logging

from fastapi import APIRouter, HTTPException

from backend.schemas.code_review import (
    BuildRequest,
    GraphData,
    GraphDataRequest,
    GraphStats,
    ImpactRequest,
    ImpactResult,
)
from backend.services import code_review_service
from backend.services.project_service import get_project

router = APIRouter()
logger = logging.getLogger("factory")


@router.get("/stats", response_model=GraphStats)
async def get_stats(project_id: str) -> GraphStats:
    """Return graph build status and statistics."""
    project = _get_project_or_404(project_id)
    return code_review_service.get_stats(project.path)


@router.post("/build", response_model=GraphStats)
async def build_graph(project_id: str, body: BuildRequest = BuildRequest()) -> GraphStats:
    """Build or rebuild the dependency graph for the project."""
    project = _get_project_or_404(project_id)
    try:
        return code_review_service.build_graph(project.path, body.full_rebuild)
    except ValueError as exc:
        _raise_review_error(exc)


@router.post("/graph-data", response_model=GraphData)
async def get_graph_data(project_id: str, body: GraphDataRequest = GraphDataRequest()) -> GraphData:
    """Return graph nodes and edges for the requested mode."""
    project = _get_project_or_404(project_id)
    try:
        return code_review_service.get_graph_data(
            project.path,
            mode=body.mode,
            targets=body.targets,
            depth=body.depth,
            kind_filter=body.kind_filter,
        )
    except ValueError as exc:
        _raise_review_error(exc)


@router.post("/impact", response_model=ImpactResult)
async def get_impact(project_id: str, body: ImpactRequest) -> ImpactResult:
    """Compute blast radius — all files transitively affected by changed_files."""
    project = _get_project_or_404(project_id)
    try:
        return code_review_service.get_impact(project.path, body.changed_files, body.max_depth)
    except ValueError as exc:
        _raise_review_error(exc)


@router.get("/nodes")
async def get_nodes(project_id: str) -> list:
    """Return lightweight node list for autocomplete."""
    project = _get_project_or_404(project_id)
    try:
        return code_review_service.get_nodes(project.path)
    except ValueError as exc:
        _raise_review_error(exc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_project_or_404(project_id: str):
    project = get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _raise_review_error(exc: ValueError) -> None:
    code = str(exc)
    if code == "graph_not_built":
        raise HTTPException(status_code=400, detail="Graph not built yet", headers={"X-Error-Code": code})
    if code == "not_a_git_repo":
        raise HTTPException(status_code=400, detail="Not a git repository", headers={"X-Error-Code": code})
    if code == "no_targets":
        raise HTTPException(status_code=400, detail="Focus mode requires targets", headers={"X-Error-Code": code})
    raise HTTPException(status_code=500, detail=f"Code review error: {code}")
