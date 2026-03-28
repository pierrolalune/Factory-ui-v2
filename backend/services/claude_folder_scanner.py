"""Scan a project's .claude/ directory for available slash commands and library items.

Provides:
  scan_commands()    — project command/skill discovery (existing)
  scan_claude_dir()  — full .claude/ scan for library import
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import TYPE_CHECKING

import yaml

from backend.schemas.run import CommandInfo

if TYPE_CHECKING:
    from backend.schemas.library import LibraryItemType, ScannedItem

logger = logging.getLogger("factory")

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_SCAN_DIRS = ["commands", "skills"]

# Maps .claude/ subdirectory names to library item types
_DIR_TYPE_MAP: dict[str, str] = {
    "commands": "command",
    "skills": "skill",
    "workflows": "workflow",
    "agents": "agent",
}


# ---------------------------------------------------------------------------
# Frontmatter helpers
# ---------------------------------------------------------------------------


def _parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter dict from a markdown file. Returns {} on failure."""
    match = _FRONTMATTER_RE.match(content)
    if not match:
        return {}
    try:
        parsed = yaml.safe_load(match.group(1))
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _extract_description(content: str) -> str:
    """Extract first non-heading, non-empty line as description."""
    for line in content.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            return stripped[:200]
    return ""


def _title_case_stem(stem: str) -> str:
    """Convert 'feature-spec' → 'Feature Spec'."""
    return " ".join(word.capitalize() for word in stem.replace("-", " ").replace("_", " ").split())


# ---------------------------------------------------------------------------
# Existing: command scanning for run router
# ---------------------------------------------------------------------------


def _build_command_info(md_file: Path, project_path: str, subdir: str) -> CommandInfo:
    """Build a CommandInfo from a single .md file path."""
    stem = md_file.stem
    content = md_file.read_text(encoding="utf-8", errors="replace")
    frontmatter = _parse_frontmatter(content)
    rel_path = md_file.relative_to(project_path).as_posix()

    return CommandInfo(
        stem=stem,
        name=frontmatter.get("name") or stem,
        description=frontmatter.get("description") or "",
        source_path=rel_path,
        type="command" if subdir == "commands" else "skill",
        has_arguments="$ARGUMENTS" in content,
    )


def scan_commands(project_path: str) -> list[CommandInfo]:
    """Scan project/.claude/commands/ and .claude/skills/ for available commands.

    Returns an empty list when directories don't exist or contain no .md files.
    """
    base = Path(project_path) / ".claude"
    if not base.exists():
        return []

    results: list[CommandInfo] = []
    for subdir in _SCAN_DIRS:
        scan_dir = base / subdir
        if not scan_dir.exists() or not scan_dir.is_dir():
            continue
        for md_file in sorted(scan_dir.glob("*.md")):
            try:
                results.append(_build_command_info(md_file, project_path, subdir))
            except Exception as exc:
                logger.warning("Failed to parse command file %s: %s", md_file, exc)

    return results


# ---------------------------------------------------------------------------
# New: full .claude/ scan for library import
# ---------------------------------------------------------------------------


def scan_claude_dir(claude_path: str) -> list["ScannedItem"]:
    """Scan a .claude/ directory and return importable items.

    Checks each item against the current library to set already_in_library.
    """
    from backend.services.library_service import list_items

    base = Path(claude_path)
    if not base.exists():
        return []

    existing = {(s.name, s.type) for s in list_items()}

    scanned: list[ScannedItem] = []

    # Scan typed subdirectories
    for dir_name, item_type in _DIR_TYPE_MAP.items():
        sub = base / dir_name
        if not sub.exists() or not sub.is_dir():
            continue
        for md_file in sorted(sub.glob("*.md")):
            item = _build_scanned_item(md_file, item_type, existing)  # type: ignore[arg-type]
            if item:
                scanned.append(item)

    # Scan CLAUDE.md at root
    claude_md = base / "CLAUDE.md"
    if claude_md.exists():
        item = _build_scanned_item(claude_md, "claude-md", existing)  # type: ignore[arg-type]
        if item:
            scanned.append(item)

    return scanned


def _build_scanned_item(
    md_file: Path,
    item_type: "LibraryItemType",
    existing: set[tuple[str, str]],
) -> "ScannedItem | None":
    """Parse a .md file into a ScannedItem. Returns None on read error."""
    from backend.schemas.library import ScannedItem
    from backend.services.library_service import list_items

    try:
        content = md_file.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        logger.warning("Cannot read %s: %s", md_file, exc)
        return None

    name = md_file.stem if item_type != "claude-md" else "CLAUDE"
    description = _extract_description(content)
    preview = content[:200]
    already = (name, item_type) in existing

    existing_id: str | None = None
    if already:
        matches = [s for s in list_items() if s.name == name and s.type == item_type]
        existing_id = matches[0].id if matches else None

    return ScannedItem(
        name=name,
        type=item_type,
        source_path=str(md_file),
        description=description,
        content_preview=preview,
        already_in_library=already,
        existing_id=existing_id,
    )


# ---------------------------------------------------------------------------
# Import selected items
# ---------------------------------------------------------------------------


def import_items(scan_root: str, items: list[dict]) -> "dict":
    """Import selected scanned items into the library.

    Each entry in `items` is {'source_path': str, 'overwrite': bool}.
    Returns ImportResult dict.
    """
    from backend.schemas.library import ImportResult, LibraryItemCreate
    from backend.services.library_service import create_item, get_item, list_items, update_item

    result = ImportResult(imported=0, skipped=0, overwritten=0, errors=[])
    base = Path(scan_root)

    for req in items:
        src = Path(req["source_path"])
        overwrite = req.get("overwrite", False)
        try:
            content = src.read_text(encoding="utf-8", errors="replace")
        except Exception as exc:
            result.errors.append({"file": str(src), "reason": str(exc)})
            continue

        item_type = _detect_type(src, base)
        name = src.stem if item_type != "claude-md" else "CLAUDE"
        description = _extract_description(content)

        existing = [s for s in list_items() if s.name == name and s.type == item_type]

        if existing and not overwrite:
            result.skipped += 1
            continue

        if existing and overwrite:
            from backend.schemas.library import LibraryItemUpdate

            upd = LibraryItemUpdate(content=content, description=description)
            update_item(existing[0].id, upd)
            result.overwritten += 1
        else:
            create_data = LibraryItemCreate(
                name=name,
                type=item_type,
                description=description,
                content=content,
                tags=[],
            )
            try:
                new_id = create_item(create_data)
                # Patch source to "imported"
                item_data = get_item(new_id)
                if item_data:
                    from backend.services.library_service import (
                        _load_index,
                        _load_item,
                        _save_index,
                        _save_item,
                        _to_summary,
                    )

                    raw = _load_item(new_id)
                    if raw:
                        raw["source"] = "imported"
                        raw["imported_from"] = str(src)
                        _save_item(raw)
                        idx = _load_index()
                        for i, e in enumerate(idx):
                            if e["id"] == new_id:
                                idx[i] = _to_summary(raw)
                                break
                        _save_index(idx)
                result.imported += 1
            except ValueError:
                # Duplicate name in same batch — skip
                result.skipped += 1

    return result.model_dump()


def _detect_type(src: Path, base: Path) -> "LibraryItemType":
    """Determine item type from its position within the .claude/ tree."""
    try:
        parts = src.relative_to(base).parts
    except ValueError:
        parts = ()

    if src.name == "CLAUDE.md":
        return "claude-md"  # type: ignore[return-value]
    if parts:
        return _DIR_TYPE_MAP.get(parts[0], "skill")  # type: ignore[return-value]
    return "skill"  # type: ignore[return-value]
