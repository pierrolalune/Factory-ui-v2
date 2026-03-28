from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Git schemas
# ---------------------------------------------------------------------------


class GitFileChange(BaseModel):
    path: str
    change_type: str  # "modified" | "added" | "deleted" | "renamed"
    old_path: str | None = None


class GitStatus(BaseModel):
    branch: str
    is_dirty: bool
    staged: list[GitFileChange] = []
    unstaged: list[GitFileChange] = []
    untracked: list[str] = []
    ahead: int = 0
    behind: int = 0


class DiffLine(BaseModel):
    type: str  # "context" | "add" | "remove"
    content: str
    old_line_no: int | None = None
    new_line_no: int | None = None


class DiffHunk(BaseModel):
    header: str
    lines: list[DiffLine] = []


class GitDiff(BaseModel):
    file_path: str
    is_staged: bool
    is_binary: bool = False
    hunks: list[DiffHunk] = []


class GitCommit(BaseModel):
    hash: str
    message: str
    author: str
    date: str


# ---------------------------------------------------------------------------
# Worktree schemas
# ---------------------------------------------------------------------------


class Worktree(BaseModel):
    id: str
    project_id: str
    branch: str
    path: str
    base_branch: str
    created_at: str
    is_dirty: bool = False
    ahead: int = 0
    commit_sha: str | None = None


class WorktreeCreate(BaseModel):
    branch: str
    base_branch: str = "main"
    create_branch: bool = True
