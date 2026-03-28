"""System router — filesystem browse and project discovery."""

from fastapi import APIRouter, HTTPException, Query

from backend.schemas.project import BrowseResponse, DiscoverResponse
from backend.services import project_service

router = APIRouter()


@router.get("/browse", response_model=BrowseResponse)
async def browse(
    path: str = Query(...),
    show_hidden: bool = Query(default=False),
) -> BrowseResponse:
    """Browse filesystem directories. Use '~' for home directory."""
    try:
        return project_service.browse_directory(path, show_hidden)
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail={"detail": "Path not found", "code": "path_not_found"})
    except NotADirectoryError:
        raise HTTPException(
            status_code=400, detail={"detail": "Path is not a directory", "code": "not_a_directory"}
        )


@router.get("/discover-projects", response_model=DiscoverResponse)
async def discover_projects(
    base_path: str | None = Query(default=None),
    depth: int = Query(default=2, ge=1, le=5),
) -> DiscoverResponse:
    """Scan for project candidates under base_path."""
    candidates = project_service.discover_projects(base_path, depth)
    return DiscoverResponse(candidates=candidates)
