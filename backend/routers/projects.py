"""Projects router — CRUD + File API."""

from fastapi import APIRouter, HTTPException, Query

from backend.schemas.project import (
    FileContent,
    FileNode,
    FileWrite,
    PathInfo,
    ProjectCreate,
    ProjectSummary,
    ProjectUpdate,
)
from backend.services import project_service

router = APIRouter()


@router.get("", response_model=list[ProjectSummary])
async def list_projects() -> list[ProjectSummary]:
    """List all registered projects."""
    return project_service.list_projects()


@router.get("/validate-path", response_model=PathInfo)
async def validate_path(path: str = Query(...)) -> PathInfo:
    """Validate a filesystem path before project creation."""
    return project_service.validate_path(path)


@router.post("")
async def create_project(body: ProjectCreate) -> dict:
    """Register a new project."""
    try:
        return project_service.create_project(body)
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail={"detail": "Path not found", "code": "path_not_found"})
    except ValueError:
        raise HTTPException(
            status_code=409, detail={"detail": "Path already registered", "code": "already_registered"}
        )
    except RuntimeError:
        raise HTTPException(
            status_code=500, detail={"detail": "Git init failed", "code": "git_init_failed"}
        )


@router.get("/{project_id}", response_model=ProjectSummary)
async def get_project(project_id: str) -> ProjectSummary:
    """Fetch a single project."""
    project = project_service.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail={"detail": "Not found", "code": "not_found"})
    return project


@router.patch("/{project_id}", response_model=ProjectSummary)
async def update_project(project_id: str, body: ProjectUpdate) -> ProjectSummary:
    """Update mutable project fields."""
    project = project_service.update_project(project_id, body)
    if project is None:
        raise HTTPException(status_code=404, detail={"detail": "Not found", "code": "not_found"})
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str) -> dict:
    """Remove a project from the registry."""
    found = project_service.delete_project(project_id)
    if not found:
        raise HTTPException(status_code=404, detail={"detail": "Not found", "code": "not_found"})
    return {"ok": True}


@router.get("/{project_id}/file-tree", response_model=list[FileNode])
async def get_file_tree(
    project_id: str,
    worktree_path: str | None = Query(default=None),
) -> list[FileNode]:
    """Return the recursive file tree, excluding .git, node_modules, etc."""
    tree = project_service.get_file_tree(project_id, worktree_path)
    if tree is None:
        raise HTTPException(status_code=404, detail={"detail": "Not found", "code": "not_found"})
    return tree


@router.get("/{project_id}/file", response_model=FileContent)
async def read_file(
    project_id: str,
    path: str = Query(...),
    worktree_path: str | None = Query(default=None),
) -> FileContent:
    """Read a single file (max 1 MB)."""
    try:
        result = project_service.read_file(project_id, path, worktree_path)
    except PermissionError:
        raise HTTPException(
            status_code=400, detail={"detail": "Path outside project", "code": "path_outside_project"}
        )
    except FileNotFoundError as exc:
        code = str(exc)
        if code == "project_not_found":
            raise HTTPException(status_code=404, detail={"detail": "Not found", "code": "not_found"})
        raise HTTPException(status_code=404, detail={"detail": "File not found", "code": "file_not_found"})
    except OverflowError:
        raise HTTPException(status_code=400, detail={"detail": "File too large", "code": "file_too_large"})
    if result is None:
        raise HTTPException(status_code=404, detail={"detail": "Not found", "code": "not_found"})
    return result


@router.put("/{project_id}/file")
async def write_file(project_id: str, body: FileWrite) -> dict:
    """Write a file into the project directory."""
    try:
        project_service.write_file(project_id, body.path, body.content, body.worktree_path)
    except PermissionError:
        raise HTTPException(
            status_code=400, detail={"detail": "Path outside project", "code": "path_outside_project"}
        )
    except IsADirectoryError:
        raise HTTPException(
            status_code=400, detail={"detail": "Path is a directory", "code": "is_directory"}
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail={"detail": "Not found", "code": "not_found"})
    return {"ok": True}
