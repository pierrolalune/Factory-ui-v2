"""Library service — flat JSON storage for reusable .claude/ items.

Storage layout:
  ClaudeLibrairy/_index.json          -> list[LibraryItemSummary]
  ClaudeLibrairy/items/{id}.json      -> LibraryItem (with content)
"""

from __future__ import annotations

import json
import logging
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path

from backend.schemas.library import (
    LibraryItem,
    LibraryItemCreate,
    LibraryItemSource,
    LibraryItemSummary,
    LibraryItemType,
    LibraryItemUpdate,
)

logger = logging.getLogger("factory")

# Patched in tests via unittest.mock.patch
LIBRARY_DIR: Path = Path("ClaudeLibrairy")


# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------


def _index_path() -> Path:
    return LIBRARY_DIR / "_index.json"


def _item_path(item_id: str) -> Path:
    return LIBRARY_DIR / "items" / f"{item_id}.json"


def _ensure_dirs() -> None:
    (LIBRARY_DIR / "items").mkdir(parents=True, exist_ok=True)


def _load_index() -> list[dict]:
    path = _index_path()
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to parse library index: %s", exc)
        return []


def _save_index(items: list[dict]) -> None:
    _ensure_dirs()
    _index_path().write_text(json.dumps(items, indent=2), encoding="utf-8")


def _load_item(item_id: str) -> dict | None:
    path = _item_path(item_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to parse library item %s: %s", item_id, exc)
        return None


def _save_item(item: dict) -> None:
    _ensure_dirs()
    _item_path(item["id"]).write_text(json.dumps(item, indent=2), encoding="utf-8")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# ID generation
# ---------------------------------------------------------------------------


def _make_id(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]
    return f"li-{slug}-{secrets.token_hex(3)}"


# ---------------------------------------------------------------------------
# Summary builder
# ---------------------------------------------------------------------------


def _to_summary(item: dict) -> dict:
    """Extract summary fields from a full item dict."""
    config = item.get("config") or {}
    args = config.get("args") or [] if config else []
    return {
        "id": item["id"],
        "name": item["name"],
        "type": item["type"],
        "source": item["source"],
        "description": item["description"],
        "tags": item.get("tags", []),
        "linked_command_stem": item.get("linked_command_stem"),
        "has_structured_args": bool(args),
        "updated_at": item["updated_at"],
    }


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def list_items(
    type_filter: LibraryItemType | None = None,
    source_filter: LibraryItemSource | None = None,
    tags: list[str] | None = None,
    q: str | None = None,
) -> list[LibraryItemSummary]:
    """Return summaries filtered by type, source, tags (OR logic), and full-text query."""
    index = _load_index()
    results = []
    q_lower = q.lower() if q else None
    for raw in index:
        if type_filter and raw.get("type") != type_filter:
            continue
        if source_filter and raw.get("source") != source_filter:
            continue
        if tags:
            item_tags = raw.get("tags") or []
            if not any(t in item_tags for t in tags):
                continue
        if q_lower:
            searchable = f"{raw.get('name', '')} {raw.get('description', '')}".lower()
            if q_lower not in searchable:
                continue
        results.append(LibraryItemSummary(**raw))
    return results


def get_item(item_id: str) -> LibraryItem | None:
    """Return full item including content, or None if not found."""
    data = _load_item(item_id)
    if data is None:
        return None
    return LibraryItem(**data)


def create_item(data: LibraryItemCreate) -> str:
    """Create a new user item. Returns the new item ID."""
    index = _load_index()
    if any(i["name"] == data.name for i in index):
        raise ValueError("duplicate_name")
    item_id = _make_id(data.name)
    now = _now_iso()
    item_dict = {
        "id": item_id,
        "name": data.name,
        "type": data.type,
        "source": "user",
        "description": data.description,
        "content": data.content,
        "tags": data.tags,
        "linked_command_stem": data.linked_command_stem,
        "has_structured_args": bool(data.config and data.config.args),
        "imported_from": None,
        "created_at": now,
        "updated_at": now,
        "config": data.config.model_dump() if data.config else None,
        "agent_deps": data.agent_deps,
    }
    _save_item(item_dict)
    index.append(_to_summary(item_dict))
    _save_index(index)
    return item_id


def update_item(item_id: str, data: LibraryItemUpdate) -> LibraryItem | None:
    """Update a user/imported item. Rejects builtin items (raises PermissionError)."""
    item_data = _load_item(item_id)
    if item_data is None:
        return None
    if item_data.get("source") == "builtin":
        raise PermissionError("cannot_modify_builtin")
    if data.name is not None:
        item_data["name"] = data.name
    if data.description is not None:
        item_data["description"] = data.description
    if data.content is not None:
        item_data["content"] = data.content
    if data.tags is not None:
        item_data["tags"] = data.tags
    if data.config is not None:
        item_data["config"] = data.config.model_dump()
    if data.linked_command_stem is not None:
        item_data["linked_command_stem"] = data.linked_command_stem
    if data.agent_deps is not None:
        item_data["agent_deps"] = data.agent_deps
    item_data["updated_at"] = _now_iso()
    item_data["has_structured_args"] = bool((item_data.get("config") or {}).get("args"))
    _save_item(item_data)
    index = _load_index()
    for i, entry in enumerate(index):
        if entry["id"] == item_id:
            index[i] = _to_summary(item_data)
            break
    _save_index(index)
    return LibraryItem(**item_data)


def delete_item(item_id: str) -> bool:
    """Delete a user/imported item. Rejects builtin items (raises PermissionError)."""
    item_data = _load_item(item_id)
    if item_data is None:
        return False
    if item_data.get("source") == "builtin":
        raise PermissionError("cannot_delete_builtin")
    _item_path(item_id).unlink(missing_ok=True)
    index = [i for i in _load_index() if i["id"] != item_id]
    _save_index(index)
    return True


def get_all_tags() -> list[str]:
    """Return unique tags across all library items, sorted alphabetically."""
    tags: set[str] = set()
    for item in _load_index():
        tags.update(item.get("tags") or [])
    return sorted(tags)


# ---------------------------------------------------------------------------
# Copy to project
# ---------------------------------------------------------------------------


def copy_to_project(item_id: str, project_id: str) -> dict:
    """Write item content into project/.claude/{type}s/{stem}.md.

    Returns {"ok": True, "copied_to": relative_path}.
    Raises FileNotFoundError for missing project, FileExistsError if already present.
    """
    from backend.services.project_service import get_project

    item = get_item(item_id)
    if item is None:
        raise FileNotFoundError("item_not_found")

    project = get_project(project_id)
    if project is None:
        raise FileNotFoundError("project_not_found")

    dest_rel = _resolve_dest_path(item)
    dest_abs = Path(project.path) / dest_rel

    if dest_abs.exists():
        raise FileExistsError("already_exists")

    dest_abs.parent.mkdir(parents=True, exist_ok=True)
    dest_abs.write_text(item.content, encoding="utf-8")

    _copy_agent_deps(item, project.path)

    return {"ok": True, "copied_to": dest_rel}


def _resolve_dest_path(item: LibraryItem) -> str:
    """Map item type to its .claude/ subdirectory path."""
    type_map = {
        "command": "commands",
        "workflow": "workflows",
        "skill": "skills",
        "agent": "agents",
    }
    stem = re.sub(r"[^a-z0-9\-]+", "-", item.name.lower()).strip("-")
    if item.type == "claude-md":
        return "CLAUDE.md"
    subdir = type_map.get(item.type, item.type + "s")
    return f".claude/{subdir}/{stem}.md"


def _copy_agent_deps(item: LibraryItem, project_path: str) -> None:
    """Copy referenced agent items into project/.claude/agents/ for workflow items."""
    if item.type != "workflow" or not item.agent_deps:
        return
    for dep_id in item.agent_deps:
        dep = get_item(dep_id)
        if dep is None:
            continue
        stem = re.sub(r"[^a-z0-9\-]+", "-", dep.name.lower()).strip("-")
        dest = Path(project_path) / ".claude" / "agents" / f"{stem}.md"
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(dep.content, encoding="utf-8")
