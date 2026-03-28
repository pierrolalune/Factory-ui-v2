from pydantic import BaseModel


class Project(BaseModel):
    id: str
    name: str
    path: str
    description: str | None = None
    github_remote: str | None = None
    created_at: str
    last_run_at: str | None = None


class ProjectCreate(BaseModel):
    name: str
    path: str
    description: str | None = None
    github_remote: str | None = None
    init_git: bool = False


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    github_remote: str | None = None


class ProjectSummary(Project):
    active_run_count: int = 0
    last_run_status: str | None = None
    last_run_cost_usd: float | None = None


class PathInfo(BaseModel):
    exists: bool
    already_registered: bool
    existing_project_id: str | None = None
    is_git_repo: bool = False
    has_claude_md: bool = False
    suggested_name: str | None = None
    detected_stack: list[str] = []


class DirectoryEntry(BaseModel):
    name: str
    path: str
    is_project_candidate: bool = False
    children_count: int = 0
    detected_stack: list[str] = []


class BrowseResponse(BaseModel):
    current_path: str
    parent_path: str | None = None
    entries: list[DirectoryEntry] = []


class DiscoverResponse(BaseModel):
    candidates: list[DirectoryEntry] = []


class FileNode(BaseModel):
    name: str
    path: str
    type: str  # "file" | "directory"
    children: list["FileNode"] | None = None
    size: int | None = None


class FileContent(BaseModel):
    content: str
    size: int


class FileWrite(BaseModel):
    path: str
    content: str
    worktree_path: str | None = None
