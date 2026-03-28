"""Tests for .claude/ directory scanner and import functionality."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def library_dir(tmp_path: Path):
    """Patch LIBRARY_DIR to use a temp directory for isolation."""
    lib = tmp_path / "ClaudeLibrairy"
    lib.mkdir()
    (lib / "items").mkdir()
    with patch("backend.services.library_service.LIBRARY_DIR", lib):
        yield lib


@pytest.fixture
def claude_dir(tmp_path: Path):
    """Create a minimal .claude/ directory structure for scanning."""
    base = tmp_path / "myproject" / ".claude"
    (base / "commands").mkdir(parents=True)
    (base / "skills").mkdir(parents=True)
    (base / "agents").mkdir(parents=True)

    (base / "commands" / "feature-spec.md").write_text(
        "# Feature Spec\n\nTurn an idea into a spec.",
        encoding="utf-8",
    )
    (base / "commands" / "polisher.md").write_text(
        "# Polisher\n\nCode quality cleanup pass.",
        encoding="utf-8",
    )
    (base / "skills" / "api-design.md").write_text(
        "# API Design\n\nREST API design guidelines.",
        encoding="utf-8",
    )
    (base / "agents" / "architect.md").write_text(
        "# Architect\n\nSystem architecture agent.",
        encoding="utf-8",
    )
    return base


# ---------------------------------------------------------------------------
# Scanner tests
# ---------------------------------------------------------------------------


def test_scan_finds_items(claude_dir, library_dir):
    from backend.services.claude_folder_scanner import scan_claude_dir

    items = scan_claude_dir(str(claude_dir))
    names = {i.name for i in items}
    assert "feature-spec" in names
    assert "polisher" in names
    assert "api-design" in names
    assert "architect" in names


def test_scan_returns_empty_for_missing_dir(tmp_path, library_dir):
    from backend.services.claude_folder_scanner import scan_claude_dir

    items = scan_claude_dir(str(tmp_path / "nonexistent"))
    assert items == []


def test_scan_item_types(claude_dir, library_dir):
    from backend.services.claude_folder_scanner import scan_claude_dir

    items = scan_claude_dir(str(claude_dir))
    by_name = {i.name: i for i in items}

    assert by_name["feature-spec"].type == "command"
    assert by_name["api-design"].type == "skill"
    assert by_name["architect"].type == "agent"


def test_scan_already_in_library(claude_dir, library_dir):
    """Items already in the library should be marked already_in_library=True."""
    from backend.schemas.library import LibraryItemCreate
    from backend.services.claude_folder_scanner import scan_claude_dir
    from backend.services.library_service import create_item

    create_item(LibraryItemCreate(name="polisher", type="command", description="d", content="c", tags=[]))

    items = scan_claude_dir(str(claude_dir))
    by_name = {i.name: i for i in items}

    assert by_name["polisher"].already_in_library is True
    assert by_name["feature-spec"].already_in_library is False


def test_scan_description_extraction(claude_dir, library_dir):
    """Description should be first non-heading, non-empty line."""
    from backend.services.claude_folder_scanner import scan_claude_dir

    items = scan_claude_dir(str(claude_dir))
    by_name = {i.name: i for i in items}
    assert by_name["feature-spec"].description == "Turn an idea into a spec."


# ---------------------------------------------------------------------------
# Import tests
# ---------------------------------------------------------------------------


def test_import_creates_library_items(claude_dir, library_dir):
    from backend.services.claude_folder_scanner import import_items
    from backend.services.library_service import list_items

    src1 = str(claude_dir / "commands" / "feature-spec.md")
    src2 = str(claude_dir / "skills" / "api-design.md")

    result = import_items(str(claude_dir), [
        {"source_path": src1, "overwrite": False},
        {"source_path": src2, "overwrite": False},
    ])

    assert result["imported"] == 2
    assert result["skipped"] == 0
    items = list_items()
    assert len(items) == 2


def test_import_skip_existing(claude_dir, library_dir):
    """Importing an existing item without overwrite should skip it."""
    from backend.schemas.library import LibraryItemCreate
    from backend.services.claude_folder_scanner import import_items
    from backend.services.library_service import create_item

    create_item(LibraryItemCreate(name="polisher", type="command", description="old", content="old content", tags=[]))

    src = str(claude_dir / "commands" / "polisher.md")
    result = import_items(str(claude_dir), [{"source_path": src, "overwrite": False}])

    assert result["skipped"] == 1
    assert result["imported"] == 0


def test_import_overwrite_existing(claude_dir, library_dir):
    """Importing with overwrite=True should update the existing item."""
    from backend.schemas.library import LibraryItemCreate
    from backend.services.claude_folder_scanner import import_items
    from backend.services.library_service import create_item

    create_item(LibraryItemCreate(name="polisher", type="command", description="old", content="old content", tags=[]))

    src = str(claude_dir / "commands" / "polisher.md")
    result = import_items(str(claude_dir), [{"source_path": src, "overwrite": True}])

    assert result["overwritten"] == 1


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_api_scan_endpoint(client, claude_dir, library_dir):
    project_root = str(claude_dir.parent)
    resp = await client.post("/api/library/claude-import/scan", json={"path": project_root})
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    names = {i["name"] for i in data["items"]}
    assert "feature-spec" in names


@pytest.mark.anyio
async def test_api_scan_missing_path(client, library_dir):
    resp = await client.post("/api/library/claude-import/scan", json={"path": "/nonexistent/path/xyz"})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "path_not_found"


@pytest.mark.anyio
async def test_api_scan_no_claude_dir(client, tmp_path, library_dir):
    empty_dir = tmp_path / "no-claude-here"
    empty_dir.mkdir()
    resp = await client.post("/api/library/claude-import/scan", json={"path": str(empty_dir)})
    assert resp.status_code == 400
    assert resp.json()["detail"] == "no_claude_dir"


@pytest.mark.anyio
async def test_api_import_endpoint(client, claude_dir, library_dir):
    src = str(claude_dir / "commands" / "feature-spec.md")
    resp = await client.post(
        "/api/library/claude-import/import",
        json={
            "scan_root": str(claude_dir),
            "items": [{"source_path": src, "overwrite": False}],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["imported"] == 1
