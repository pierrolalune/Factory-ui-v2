"""Code review service — build and query a file-level dependency graph.

The graph is analysed from source file imports using simple regex-based parsing.
This lightweight implementation covers the most common patterns in Python, TypeScript,
and JavaScript without requiring a full language server.

Graph data is stored in memory per request (no persistent DB). For large projects
the graph can be rebuilt on demand via the /build endpoint.
"""

import json
import logging
import re
import subprocess
from pathlib import Path

from backend.schemas.code_review import GraphData, GraphEdge, GraphNode, GraphStats, ImpactResult

logger = logging.getLogger("factory")

# File extensions to analyse
_SOURCE_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
_EXCLUDE_DIRS = {"node_modules", ".git", ".venv", "__pycache__", "dist", "build", ".next", "coverage"}
_GRAPH_FILE = ".code-review-graph/graph.json"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_stats(project_path: str) -> GraphStats:
    """Return the current graph build status and statistics."""
    graph_file = Path(project_path) / _GRAPH_FILE
    if not graph_file.exists():
        return GraphStats(built=False, node_count=0, edge_count=0, file_count=0)

    data = _load_graph_file(graph_file)
    if data is None:
        return GraphStats(built=False, node_count=0, edge_count=0, file_count=0)

    nodes = data.get("nodes", [])
    edges = data.get("edges", [])
    files = {n["file_path"] for n in nodes}
    return GraphStats(
        built=True,
        node_count=len(nodes),
        edge_count=len(edges),
        file_count=len(files),
        last_built_at=data.get("built_at"),
    )


def build_graph(project_path: str, full_rebuild: bool = False) -> GraphStats:
    """Analyse imports in source files and persist the dependency graph.

    Uses a simple regex-based approach that covers Python imports and
    TypeScript/JavaScript ES module imports.
    """
    root = Path(project_path)
    if not (root / ".git").exists():
        raise ValueError("not_a_git_repo")

    graph_dir = root / ".code-review-graph"
    graph_dir.mkdir(exist_ok=True)
    graph_file = graph_dir / "graph.json"

    nodes, edges = _analyse_project(root)
    from datetime import datetime, timezone

    payload = {
        "nodes": [n.model_dump() for n in nodes],
        "edges": [e.model_dump() for e in edges],
        "built_at": datetime.now(timezone.utc).isoformat(),
    }
    graph_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    files = {n.file_path for n in nodes}
    return GraphStats(
        built=True,
        node_count=len(nodes),
        edge_count=len(edges),
        file_count=len(files),
        last_built_at=payload["built_at"],
    )


def get_graph_data(
    project_path: str,
    mode: str = "full",
    targets: list[str] | None = None,
    depth: int = 2,
    kind_filter: list[str] | None = None,
) -> GraphData:
    """Return graph nodes and edges according to the query mode."""
    raw = _require_graph(project_path)
    all_nodes = [GraphNode(**n) for n in raw.get("nodes", [])]
    all_edges = [GraphEdge(**e) for e in raw.get("edges", [])]

    if mode == "modified":
        modified_files = _get_modified_files(project_path)
        seed_ids = {n.id for n in all_nodes if n.file_path in modified_files}
        nodes, edges = _bfs(all_nodes, all_edges, seed_ids, depth)
    elif mode == "focus":
        if not targets:
            raise ValueError("no_targets")
        seed_ids = set(targets)
        nodes, edges = _bfs(all_nodes, all_edges, seed_ids, depth)
    else:  # full
        nodes, edges = all_nodes, all_edges

    if kind_filter:
        keep = {n.id for n in nodes if n.kind in kind_filter}
        nodes = [n for n in nodes if n.id in keep]
        edges = [e for e in edges if e.source in keep and e.target in keep]

    warning = None
    if mode == "full" and len(nodes) > 500:
        warning = "Large graph — consider using focus mode"

    return GraphData(nodes=nodes, edges=edges, warning=warning)


def get_impact(project_path: str, changed_files: list[str], max_depth: int = 3) -> ImpactResult:
    """Return all nodes/files that transitively depend on the changed files."""
    raw = _require_graph(project_path)
    all_nodes = [GraphNode(**n) for n in raw.get("nodes", [])]
    all_edges = [GraphEdge(**e) for e in raw.get("edges", [])]

    seed_ids = {n.id for n in all_nodes if n.file_path in changed_files}
    # Reverse BFS: find who imports the seeds
    affected_ids: set[str] = set()
    frontier = set(seed_ids)
    for _ in range(max_depth):
        if not frontier:
            break
        next_frontier: set[str] = set()
        for edge in all_edges:
            if edge.target in frontier and edge.source not in affected_ids:
                next_frontier.add(edge.source)
        affected_ids |= next_frontier
        frontier = next_frontier

    affected_nodes = [n for n in all_nodes if n.id in affected_ids]
    affected_files = sorted({n.file_path for n in affected_nodes})
    return ImpactResult(
        changed_files=changed_files,
        affected_nodes=affected_nodes,
        affected_files=affected_files,
        depth=max_depth,
    )


def get_nodes(project_path: str) -> list[dict]:
    """Return lightweight node list (id, name, kind, file_path) for autocomplete."""
    raw = _require_graph(project_path)
    return [
        {"id": n["id"], "name": n["name"], "kind": n["kind"], "file_path": n["file_path"]}
        for n in raw.get("nodes", [])
    ]


# ---------------------------------------------------------------------------
# Private: graph analysis
# ---------------------------------------------------------------------------


def _analyse_project(root: Path) -> tuple[list[GraphNode], list[GraphEdge]]:
    """Walk source files, extract module nodes and import edges."""
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    file_to_node: dict[str, GraphNode] = {}

    source_files = _collect_source_files(root)

    for file_path in source_files:
        rel = str(file_path.relative_to(root))
        node = GraphNode(id=rel, name=file_path.name, kind="module", file_path=rel)
        nodes.append(node)
        file_to_node[rel] = node

    # Build edges from imports
    for file_path in source_files:
        rel = str(file_path.relative_to(root))
        imports = _extract_imports(file_path, root)
        for imp_path in imports:
            if imp_path in file_to_node and imp_path != rel:
                edges.append(GraphEdge(source=rel, target=imp_path, type="import"))

    return nodes, edges


def _collect_source_files(root: Path) -> list[Path]:
    """Recursively collect source files, skipping excluded dirs."""
    files: list[Path] = []
    for p in root.rglob("*"):
        if any(part in _EXCLUDE_DIRS for part in p.parts):
            continue
        if p.is_file() and p.suffix in _SOURCE_EXTENSIONS:
            files.append(p)
    return files


def _extract_imports(file_path: Path, root: Path) -> list[str]:
    """Return a list of relative file paths that this file imports."""
    try:
        text = file_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []

    imported: list[str] = []
    if file_path.suffix == ".py":
        imported = _extract_python_imports(text, file_path, root)
    else:
        imported = _extract_es_imports(text, file_path, root)

    return imported


_PY_IMPORT_RE = re.compile(r"^(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))", re.MULTILINE)
_ES_IMPORT_RE = re.compile(r"""(?:import|from)\s+['"]([^'"]+)['"]""")


def _extract_python_imports(text: str, file_path: Path, root: Path) -> list[str]:
    """Resolve relative Python imports to project-relative file paths."""
    results: list[str] = []
    for match in _PY_IMPORT_RE.finditer(text):
        module = (match.group(1) or match.group(2) or "").strip()
        resolved = _resolve_python_module(module, file_path, root)
        if resolved:
            results.append(resolved)
    return results


def _resolve_python_module(module: str, from_file: Path, root: Path) -> str | None:
    """Convert a Python module name to a project-relative path if it exists."""
    parts = module.replace(".", "/")
    candidates = [
        root / f"{parts}.py",
        root / parts / "__init__.py",
    ]
    for c in candidates:
        if c.exists():
            return str(c.relative_to(root))
    return None


def _extract_es_imports(text: str, file_path: Path, root: Path) -> list[str]:
    """Resolve relative ES module imports to project-relative file paths."""
    results: list[str] = []
    for match in _ES_IMPORT_RE.finditer(text):
        spec = match.group(1)
        if not spec.startswith("."):
            continue
        resolved = _resolve_es_import(spec, file_path, root)
        if resolved:
            results.append(resolved)
    return results


def _resolve_es_import(spec: str, from_file: Path, root: Path) -> str | None:
    """Resolve a relative ES import specifier to a project-relative path."""
    base = from_file.parent / spec
    extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]
    for ext in extensions:
        candidate = Path(str(base) + ext)
        if candidate.exists() and candidate.is_file():
            try:
                return str(candidate.relative_to(root))
            except ValueError:
                pass
    return None


# ---------------------------------------------------------------------------
# Private: graph helpers
# ---------------------------------------------------------------------------


def _require_graph(project_path: str) -> dict:
    """Load graph from disk or raise ValueError('graph_not_built')."""
    graph_file = Path(project_path) / _GRAPH_FILE
    data = _load_graph_file(graph_file)
    if data is None:
        raise ValueError("graph_not_built")
    return data


def _load_graph_file(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to load graph file %s: %s", path, exc)
        return None


def _bfs(
    all_nodes: list[GraphNode],
    all_edges: list[GraphEdge],
    seed_ids: set[str],
    depth: int,
) -> tuple[list[GraphNode], list[GraphEdge]]:
    """BFS expansion from seed IDs up to given depth in both directions."""
    visited = set(seed_ids)
    frontier = set(seed_ids)

    for _ in range(depth):
        if not frontier:
            break
        next_f: set[str] = set()
        for edge in all_edges:
            if edge.source in frontier and edge.target not in visited:
                next_f.add(edge.target)
            if edge.target in frontier and edge.source not in visited:
                next_f.add(edge.source)
        visited |= next_f
        frontier = next_f

    result_nodes = [n for n in all_nodes if n.id in visited]
    result_edges = [e for e in all_edges if e.source in visited and e.target in visited]
    return result_nodes, result_edges


def _get_modified_files(project_path: str) -> set[str]:
    """Return set of relative file paths modified since HEAD."""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return {line.strip() for line in result.stdout.splitlines() if line.strip()}
    except Exception:
        pass
    return set()
