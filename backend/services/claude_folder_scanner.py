"""Scan a project's .claude/ directory for available slash commands.

Reads .md files from {project_path}/.claude/commands/ and .claude/skills/,
parses YAML frontmatter, and detects $ARGUMENTS placeholders.
"""

import logging
import re
from pathlib import Path

import yaml

from backend.schemas.run import CommandInfo

logger = logging.getLogger("factory")

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_SCAN_DIRS = ["commands", "skills"]


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
