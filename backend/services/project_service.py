"""Project service — CRUD, validation, file API, stack detection."""

import json
import logging
import re
import secrets
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from backend.schemas.project import (
    BrowseResponse,
    DirectoryEntry,
    FileContent,
    FileNode,
    PathInfo,
    Project,
    ProjectCreate,
    ProjectSummary,
    ProjectUpdate,
)

logger = logging.getLogger("factory")

# Patched in tests via unittest.mock.patch
PROJECTS_FILE: Path = Path.home() / ".factory-cli-projects.json"
PROJECTS_DIR: Path = Path.home() / ".factory-projects"

_EXCLUDE_DIRS = {".git", "node_modules", ".venv", "__pycache__", "dist", "build"}
_CANDIDATE_MARKERS = {".git", "package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml"}
_MAX_FILE_BYTES = 1024 * 1024  # 1 MB


# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------


def _load_projects() -> list[dict]:
    if not PROJECTS_FILE.exists():
        return []
    try:
        return json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to parse projects file: %s", exc)
        return []


def _save_projects(projects: list[dict]) -> None:
    PROJECTS_FILE.write_text(json.dumps(projects, indent=2), encoding="utf-8")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Stack detection
# ---------------------------------------------------------------------------


def detect_stack(project_path: Path) -> list[str]:
    """Detect technology stack from marker files in the directory."""
    stack: list[str] = []
    pkg = project_path / "package.json"
    if pkg.exists():
        stack.append("Node.js")
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
            if "react" in deps:
                stack.append("React")
            if "next" in deps:
                stack.append("Next.js")
            if "vue" in deps:
                stack.append("Vue")
            if "typescript" in deps or (project_path / "tsconfig.json").exists():
                stack.append("TypeScript")
        except Exception:
            pass
    if (project_path / "requirements.txt").exists() or (project_path / "pyproject.toml").exists():
        stack.append("Python")
    if (project_path / "Cargo.toml").exists():
        stack.append("Rust")
    if (project_path / "go.mod").exists():
        stack.append("Go")
    if (project_path / "pom.xml").exists() or (project_path / "build.gradle").exists():
        stack.append("Java")
    return stack


def _is_candidate(path: Path) -> bool:
    return any((path / m).exists() for m in _CANDIDATE_MARKERS)


# ---------------------------------------------------------------------------
# ID generation
# ---------------------------------------------------------------------------


def _make_id(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40]
    return f"{slug}-{secrets.token_hex(3)}"


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def list_projects() -> list[ProjectSummary]:
    return [ProjectSummary(**p) for p in _load_projects()]


def get_project(project_id: str) -> ProjectSummary | None:
    for p in _load_projects():
        if p["id"] == project_id:
            return ProjectSummary(**p)
    return None


def create_project(data: ProjectCreate) -> dict:
    """Register a new project. Returns {id, git_initialized}."""
    path = Path(data.path)
    if not path.exists():
        raise FileNotFoundError("path_not_found")
    projects = _load_projects()
    if any(p["path"] == str(path) for p in projects):
        raise ValueError("already_registered")

    git_initialized = False
    if data.init_git and not (path / ".git").exists():
        git_initialized = _git_init(path)

    project_id = _make_id(data.name)
    project = Project(
        id=project_id,
        name=data.name,
        path=str(path),
        description=data.description,
        github_remote=data.github_remote,
        created_at=_now_iso(),
    )
    projects.append(project.model_dump())
    _save_projects(projects)
    _ensure_project_dir(project_id)
    return {"id": project_id, "git_initialized": git_initialized}


def update_project(project_id: str, data: ProjectUpdate) -> ProjectSummary | None:
    """Patch mutable project fields."""
    projects = _load_projects()
    for p in projects:
        if p["id"] == project_id:
            if data.name is not None:
                p["name"] = data.name
            if data.description is not None:
                p["description"] = data.description
            if data.github_remote is not None:
                p["github_remote"] = data.github_remote
            _save_projects(projects)
            return ProjectSummary(**p)
    return None


def delete_project(project_id: str) -> bool:
    """Remove from registry. Does NOT touch disk files."""
    projects = _load_projects()
    new_projects = [p for p in projects if p["id"] != project_id]
    if len(new_projects) == len(projects):
        return False
    _save_projects(new_projects)
    return True


# ---------------------------------------------------------------------------
# Path validation
# ---------------------------------------------------------------------------


def validate_path(raw_path: str) -> PathInfo:
    """Return PathInfo for the given path without side effects."""
    path = Path(raw_path).expanduser()
    if not path.exists():
        return PathInfo(exists=False, already_registered=False)

    projects = _load_projects()
    registered = next((p for p in projects if p["path"] == str(path)), None)

    return PathInfo(
        exists=True,
        already_registered=registered is not None,
        existing_project_id=registered["id"] if registered else None,
        is_git_repo=(path / ".git").exists(),
        has_claude_md=(path / "CLAUDE.md").exists(),
        suggested_name=path.name,
        detected_stack=detect_stack(path),
    )


# ---------------------------------------------------------------------------
# File tree
# ---------------------------------------------------------------------------


def _build_tree(root: Path, rel_base: Path) -> list[FileNode]:
    nodes: list[FileNode] = []
    try:
        entries = sorted(root.iterdir(), key=lambda e: (e.is_file(), e.name))
    except PermissionError:
        return nodes
    for entry in entries:
        if entry.name in _EXCLUDE_DIRS:
            continue
        rel = entry.relative_to(rel_base)
        if entry.is_dir():
            children = _build_tree(entry, rel_base)
            nodes.append(FileNode(name=entry.name, path=str(rel), type="directory", children=children))
        else:
            nodes.append(FileNode(name=entry.name, path=str(rel), type="file", size=entry.stat().st_size))
    return nodes


def _resolve_root(project_path: str, worktree_path: str | None) -> Path:
    """Resolve and validate the root directory for file operations."""
    project_root = Path(project_path).resolve()
    if worktree_path is None:
        return project_root
    wt = Path(worktree_path).resolve()
    # Worktree must share the same parent as the project (sibling directory)
    if wt.parent != project_root.parent and not str(wt).startswith(str(project_root)):
        raise PermissionError("path_outside_project")
    return wt


def get_file_tree(project_id: str, worktree_path: str | None = None) -> list[FileNode] | None:
    project = get_project(project_id)
    if project is None:
        return None
    root = _resolve_root(project.path, worktree_path)
    return _build_tree(root, root)


# ---------------------------------------------------------------------------
# File read / write
# ---------------------------------------------------------------------------


def read_file(project_id: str, rel_path: str, worktree_path: str | None = None) -> FileContent | None:
    """Read a project file. Returns None if project not found."""
    project = get_project(project_id)
    if project is None:
        return None
    root = _resolve_root(project.path, worktree_path)
    target = (root / rel_path).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        raise PermissionError("path_outside_project")
    if not target.exists() or target.is_dir():
        raise FileNotFoundError("file_not_found")
    size = target.stat().st_size
    if size > _MAX_FILE_BYTES:
        raise OverflowError("file_too_large")
    content = target.read_text(encoding="utf-8", errors="replace")
    return FileContent(content=content, size=size)


def write_file(
    project_id: str, rel_path: str, content: str, worktree_path: str | None = None
) -> None:
    """Write a file inside the project. Raises on path traversal."""
    project = get_project(project_id)
    if project is None:
        raise FileNotFoundError("project_not_found")
    root = _resolve_root(project.path, worktree_path)
    target = (root / rel_path).resolve()
    # Guard: resolved path must stay inside the root
    try:
        target.relative_to(root)
    except ValueError:
        raise PermissionError("path_outside_project")
    if target.is_dir():
        raise IsADirectoryError("is_directory")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# Browse & Discover
# ---------------------------------------------------------------------------


def browse_directory(raw_path: str, show_hidden: bool = False) -> BrowseResponse:
    path = Path(raw_path).expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError("path_not_found")
    if not path.is_dir():
        raise NotADirectoryError("not_a_directory")

    parent = str(path.parent) if path != path.parent else None
    entries: list[DirectoryEntry] = []
    try:
        children = sorted(path.iterdir(), key=lambda e: e.name.lower())
    except PermissionError:
        children = []

    for entry in children:
        if not show_hidden and entry.name.startswith("."):
            continue
        if not entry.is_dir():
            continue
        sub_count = 0
        try:
            sub_count = sum(1 for e in entry.iterdir() if e.is_dir())
        except PermissionError:
            pass
        entries.append(
            DirectoryEntry(
                name=entry.name,
                path=str(entry),
                is_project_candidate=_is_candidate(entry),
                children_count=sub_count,
            )
        )
    return BrowseResponse(current_path=str(path), parent_path=parent, entries=entries)


def discover_projects(base_path: str | None = None, depth: int = 2) -> list[DirectoryEntry]:
    """Scan for project candidates up to `depth` levels deep."""
    root = Path(base_path).expanduser().resolve() if base_path else Path.home()
    registered_paths = {p["path"] for p in _load_projects()}
    candidates: list[DirectoryEntry] = []
    _recurse_discover(root, root, depth, registered_paths, candidates)
    return candidates


def _recurse_discover(
    current: Path,
    root: Path,
    remaining: int,
    registered: set,
    out: list[DirectoryEntry],
) -> None:
    if remaining < 0:
        return
    try:
        entries = sorted(current.iterdir(), key=lambda e: e.name.lower())
    except PermissionError:
        return
    for entry in entries:
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        if str(entry) in registered:
            continue
        if _is_candidate(entry):
            try:
                sub_count = sum(1 for e in entry.iterdir() if e.is_dir())
            except PermissionError:
                sub_count = 0
            out.append(
                DirectoryEntry(
                    name=entry.name,
                    path=str(entry),
                    is_project_candidate=True,
                    children_count=sub_count,
                    detected_stack=detect_stack(entry),
                )
            )
        elif remaining > 0:
            _recurse_discover(entry, root, remaining - 1, registered, out)


# ---------------------------------------------------------------------------
# Git init helper
# ---------------------------------------------------------------------------


def _git_init(path: Path) -> bool:
    """Run git init + add -A + commit in path. Raises RuntimeError on failure."""
    try:
        subprocess.run(["git", "init"], cwd=path, check=True, capture_output=True)
        subprocess.run(["git", "add", "-A"], cwd=path, check=True, capture_output=True)
        subprocess.run(
            ["git", "commit", "-m", "Initial commit"],
            cwd=path,
            check=True,
            capture_output=True,
        )
        return True
    except subprocess.CalledProcessError as exc:
        logger.warning("git init failed in %s: %s", path, exc)
        raise RuntimeError("git_init_failed") from exc


def _ensure_project_dir(project_id: str) -> None:
    """Create per-project data directory if it doesn't exist."""
    (PROJECTS_DIR / project_id).mkdir(parents=True, exist_ok=True)
