"""Pydantic schemas for the code review dependency graph feature."""

from pydantic import BaseModel


class GraphNode(BaseModel):
    id: str
    name: str
    kind: str  # "function" | "class" | "type" | "module" | "variable" | "export"
    file_path: str
    line_number: int | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str  # "import" | "call" | "extends" | "implements"


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    warning: str | None = None


class GraphStats(BaseModel):
    built: bool
    node_count: int
    edge_count: int
    file_count: int
    last_built_at: str | None = None


class ImpactResult(BaseModel):
    changed_files: list[str]
    affected_nodes: list[GraphNode]
    affected_files: list[str]
    depth: int


class BuildRequest(BaseModel):
    full_rebuild: bool = False


class GraphDataRequest(BaseModel):
    mode: str = "full"  # "full" | "focus" | "modified"
    targets: list[str] = []
    depth: int = 2
    kind_filter: list[str] | None = None


class ImpactRequest(BaseModel):
    changed_files: list[str]
    max_depth: int = 3
