"""Claude import router — scan and import items from a .claude/ directory."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from backend.schemas.library import ImportRequest, ScanRequest, ScanResponse
from backend.services.claude_folder_scanner import import_items, scan_claude_dir

router = APIRouter()


@router.post("/scan", response_model=ScanResponse)
async def scan_directory(body: ScanRequest) -> ScanResponse:
    """Scan a directory (or its .claude/ subdirectory) for importable items."""
    raw_path = Path(body.path)

    if not raw_path.exists():
        raise HTTPException(status_code=400, detail="path_not_found")

    # Resolve the .claude/ directory — accept both project roots and .claude/ directly
    if raw_path.name == ".claude" and raw_path.is_dir():
        claude_dir = raw_path
    else:
        claude_dir = raw_path / ".claude"
        if not claude_dir.exists() or not claude_dir.is_dir():
            raise HTTPException(status_code=400, detail="no_claude_dir")

    items = scan_claude_dir(str(claude_dir))
    return ScanResponse(scan_root=str(claude_dir), items=items)


@router.post("/import", response_model=dict)
async def import_selected(body: ImportRequest) -> dict:
    """Import selected items from a previous scan into the library."""
    items_dicts = [{"source_path": i.source_path, "overwrite": i.overwrite} for i in body.items]
    return import_items(body.scan_root, items_dicts)
