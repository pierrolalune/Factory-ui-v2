from fastapi import APIRouter, Query

from backend.schemas.run import RunSummary
from backend.services import run_history_service

router = APIRouter()


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
