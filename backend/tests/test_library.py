"""Tests for library service and API endpoints."""

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
    with (
        patch("backend.services.library_service.LIBRARY_DIR", lib),
    ):
        yield lib


@pytest.fixture
def sample_create():
    from backend.schemas.library import LibraryItemCreate

    return LibraryItemCreate(
        name="my-command",
        type="command",
        description="Does something useful",
        content="# My Command\n\nDo this: $ARGUMENTS",
        tags=["utility"],
    )


# ---------------------------------------------------------------------------
# Service-level tests
# ---------------------------------------------------------------------------


def test_list_items_empty(library_dir):
    from backend.services.library_service import list_items

    assert list_items() == []


def test_create_and_list(library_dir, sample_create):
    from backend.services.library_service import create_item, list_items

    item_id = create_item(sample_create)
    items = list_items()
    assert len(items) == 1
    assert items[0].id == item_id
    assert items[0].name == "my-command"
    assert items[0].source == "user"


def test_get_item_by_id(library_dir, sample_create):
    from backend.services.library_service import create_item, get_item

    item_id = create_item(sample_create)
    item = get_item(item_id)
    assert item is not None
    assert item.content == "# My Command\n\nDo this: $ARGUMENTS"
    assert item.type == "command"


def test_update_item(library_dir, sample_create):
    from backend.schemas.library import LibraryItemUpdate
    from backend.services.library_service import create_item, get_item, update_item

    item_id = create_item(sample_create)
    upd = LibraryItemUpdate(description="Updated description", tags=["new-tag"])
    updated = update_item(item_id, upd)
    assert updated is not None
    assert updated.description == "Updated description"
    assert updated.tags == ["new-tag"]
    # Persisted
    persisted = get_item(item_id)
    assert persisted is not None
    assert persisted.description == "Updated description"


def test_delete_item(library_dir, sample_create):
    from backend.services.library_service import create_item, delete_item, list_items

    item_id = create_item(sample_create)
    assert len(list_items()) == 1
    result = delete_item(item_id)
    assert result is True
    assert list_items() == []


def test_cannot_modify_builtin(library_dir):
    """Builtin items must not be modifiable."""
    from backend.schemas.library import LibraryItemUpdate
    from backend.services.library_service import _save_index, _save_item, update_item

    builtin = {
        "id": "li-builtin-aaa111",
        "name": "builtin-thing",
        "type": "command",
        "source": "builtin",
        "description": "A builtin item",
        "content": "# builtin",
        "tags": [],
        "linked_command_stem": None,
        "has_structured_args": False,
        "imported_from": None,
        "created_at": "2024-01-01T00:00:00+00:00",
        "updated_at": "2024-01-01T00:00:00+00:00",
        "config": None,
        "agent_deps": [],
    }
    _save_item(builtin)
    _save_index([{k: v for k, v in builtin.items() if k != "content" and k != "imported_from" and k != "created_at" and k != "agent_deps" and k != "config"}])

    with pytest.raises(PermissionError, match="cannot_modify_builtin"):
        update_item("li-builtin-aaa111", LibraryItemUpdate(description="hacked"))


def test_cannot_delete_builtin(library_dir):
    """Builtin items must not be deletable."""
    from backend.services.library_service import _save_index, _save_item, delete_item

    builtin = {
        "id": "li-builtin-bbb222",
        "name": "builtin-thing-2",
        "type": "skill",
        "source": "builtin",
        "description": "Another builtin",
        "content": "# builtin2",
        "tags": [],
        "linked_command_stem": None,
        "has_structured_args": False,
        "imported_from": None,
        "created_at": "2024-01-01T00:00:00+00:00",
        "updated_at": "2024-01-01T00:00:00+00:00",
        "config": None,
        "agent_deps": [],
    }
    _save_item(builtin)
    _save_index([])

    with pytest.raises(PermissionError, match="cannot_delete_builtin"):
        delete_item("li-builtin-bbb222")


def test_get_tags(library_dir):
    from backend.schemas.library import LibraryItemCreate
    from backend.services.library_service import create_item, get_all_tags

    create_item(LibraryItemCreate(name="a", type="command", description="d", content="c", tags=["beta", "alpha"]))
    create_item(LibraryItemCreate(name="b", type="skill", description="d", content="c", tags=["alpha", "gamma"]))
    tags = get_all_tags()
    assert tags == ["alpha", "beta", "gamma"]


def test_copy_to_project_writes_file(library_dir, tmp_path):
    """copy_to_project writes content to the correct .claude/ subfolder."""
    from unittest.mock import patch

    from backend.schemas.library import LibraryItemCreate
    from backend.schemas.project import Project
    from backend.services.library_service import copy_to_project, create_item

    project_path = tmp_path / "myproject"
    project_path.mkdir()

    mock_project = Project(
        id="proj-abc123",
        name="My Project",
        path=str(project_path),
        created_at="2024-01-01T00:00:00+00:00",
    )

    item_id = create_item(LibraryItemCreate(
        name="polisher",
        type="command",
        description="Code cleanup",
        content="# Polisher\nDo cleanup",
        tags=[],
    ))

    with patch("backend.services.project_service.get_project", return_value=mock_project):
        result = copy_to_project(item_id, "proj-abc123")

    assert result["ok"] is True
    dest = project_path / ".claude" / "commands" / "polisher.md"
    assert dest.exists()
    assert dest.read_text() == "# Polisher\nDo cleanup"


def test_search_filter(library_dir):
    from backend.schemas.library import LibraryItemCreate
    from backend.services.library_service import create_item, list_items

    create_item(LibraryItemCreate(name="feature-spec", type="command", description="Turn idea into spec", content="c", tags=[]))
    create_item(LibraryItemCreate(name="polisher", type="command", description="Code quality pass", content="c", tags=[]))

    results = list_items(q="quality")
    assert len(results) == 1
    assert results[0].name == "polisher"

    results = list_items(q="spec")
    assert len(results) == 1
    assert results[0].name == "feature-spec"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_api_list_empty(client, library_dir):
    resp = await client.get("/api/library")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.anyio
async def test_api_create_and_list(client, library_dir):
    payload = {
        "name": "test-item",
        "type": "skill",
        "description": "A test skill",
        "content": "# Test\nContent here",
        "tags": ["test"],
    }
    resp = await client.post("/api/library", json=payload)
    assert resp.status_code == 201
    item_id = resp.json()["id"]
    assert item_id.startswith("li-test-item")

    resp = await client.get("/api/library")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["id"] == item_id


@pytest.mark.anyio
async def test_api_get_item(client, library_dir):
    payload = {"name": "get-test", "type": "command", "description": "desc", "content": "content", "tags": []}
    create_resp = await client.post("/api/library", json=payload)
    item_id = create_resp.json()["id"]

    resp = await client.get(f"/api/library/{item_id}")
    assert resp.status_code == 200
    assert resp.json()["content"] == "content"


@pytest.mark.anyio
async def test_api_update_item(client, library_dir):
    payload = {"name": "update-test", "type": "skill", "description": "old", "content": "c", "tags": []}
    create_resp = await client.post("/api/library", json=payload)
    item_id = create_resp.json()["id"]

    resp = await client.patch(f"/api/library/{item_id}", json={"description": "new"})
    assert resp.status_code == 200
    assert resp.json()["description"] == "new"


@pytest.mark.anyio
async def test_api_delete_item(client, library_dir):
    payload = {"name": "delete-test", "type": "command", "description": "d", "content": "c", "tags": []}
    create_resp = await client.post("/api/library", json=payload)
    item_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/library/{item_id}")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = await client.get(f"/api/library/{item_id}")
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_api_cannot_modify_builtin(client, library_dir):
    from backend.services.library_service import _save_index, _save_item

    builtin = {
        "id": "li-builtin-ccc333",
        "name": "builtin-api-test",
        "type": "command",
        "source": "builtin",
        "description": "Builtin for API test",
        "content": "# builtin",
        "tags": [],
        "linked_command_stem": None,
        "has_structured_args": False,
        "imported_from": None,
        "created_at": "2024-01-01T00:00:00+00:00",
        "updated_at": "2024-01-01T00:00:00+00:00",
        "config": None,
        "agent_deps": [],
    }
    _save_item(builtin)
    _save_index([{k: v for k, v in builtin.items() if k not in ("content", "imported_from", "created_at", "agent_deps", "config")}])

    resp = await client.patch("/api/library/li-builtin-ccc333", json={"description": "hacked"})
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_api_get_tags(client, library_dir):
    await client.post("/api/library", json={"name": "t1", "type": "skill", "description": "d", "content": "c", "tags": ["zz", "aa"]})
    await client.post("/api/library", json={"name": "t2", "type": "command", "description": "d", "content": "c", "tags": ["bb"]})

    resp = await client.get("/api/library/tags")
    assert resp.status_code == 200
    assert resp.json() == ["aa", "bb", "zz"]
