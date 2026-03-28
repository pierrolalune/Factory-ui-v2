"""Library router — CRUD endpoints for the reusable .claude/ item library."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from backend.schemas.library import (
    CopyToProjectRequest,
    LibraryItem,
    LibraryItemCreate,
    LibraryItemSource,
    LibraryItemSummary,
    LibraryItemType,
    LibraryItemUpdate,
)
from backend.services import library_service

router = APIRouter()


# ---------------------------------------------------------------------------
# List + tags
# ---------------------------------------------------------------------------


@router.get("/tags", response_model=list[str])
async def get_tags() -> list[str]:
    """Return all unique tags across all library items."""
    return library_service.get_all_tags()


@router.get("", response_model=list[LibraryItemSummary])
async def list_items(
    type: Annotated[LibraryItemType | None, Query()] = None,
    source: Annotated[LibraryItemSource | None, Query()] = None,
    tags: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
) -> list[LibraryItemSummary]:
    """List library items with optional filters."""
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    return library_service.list_items(
        type_filter=type,
        source_filter=source,
        tags=tag_list,
        q=q,
    )


# ---------------------------------------------------------------------------
# CRUD — item detail
# ---------------------------------------------------------------------------


@router.get("/{item_id}", response_model=LibraryItem)
async def get_item(item_id: str) -> LibraryItem:
    item = library_service.get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="item_not_found")
    return item


@router.post("", response_model=dict, status_code=201)
async def create_item(data: LibraryItemCreate) -> dict:
    try:
        item_id = library_service.create_item(data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"id": item_id}


@router.patch("/{item_id}", response_model=LibraryItem)
async def update_item(item_id: str, data: LibraryItemUpdate) -> LibraryItem:
    try:
        item = library_service.update_item(item_id, data)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if item is None:
        raise HTTPException(status_code=404, detail="item_not_found")
    return item


@router.delete("/{item_id}", response_model=dict)
async def delete_item(item_id: str) -> dict:
    try:
        found = library_service.delete_item(item_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not found:
        raise HTTPException(status_code=404, detail="item_not_found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Copy to project
# ---------------------------------------------------------------------------


@router.post("/{item_id}/copy-to-project", response_model=dict)
async def copy_to_project(item_id: str, body: CopyToProjectRequest) -> dict:
    try:
        result = library_service.copy_to_project(item_id, body.project_id)
    except FileNotFoundError as exc:
        code = str(exc)
        status = 404
        raise HTTPException(status_code=status, detail=code) from exc
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return result
