from pydantic import BaseModel


class RunSummary(BaseModel):
    id: str
    project_id: str
    project_name: str | None = None
    type: str = "command"  # "command" | "raw"
    command_stem: str | None = None
    command_args: str | None = None
    branch: str | None = None
    worktree_path: str | None = None
    status: str = "completed"  # "active" | "awaiting_input" | "completed" | "failed" | "cancelled"
    started_at: str | None = None
    completed_at: str | None = None
    duration_seconds: float | None = None
    cost_usd: float | None = None
    phase: str | None = None  # live phase text


class RunCreate(BaseModel):
    project_id: str
    stem: str
    args: str = ""
    worktree_id: str | None = None
    effort: str | None = None  # "low"|"medium"|"high"|"max"
    skip_permissions: bool = False


class RawRunCreate(BaseModel):
    project_id: str
    worktree_id: str | None = None
    skip_permissions: bool = False


class ResumeRunCreate(BaseModel):
    session_id: str
    project_id: str
    worktree_id: str | None = None


class Run(BaseModel):
    run_id: str
    type: str = "command"
    status: str = "pending"
    exit_code: int | None = None
    project_id: str
    project_name: str = ""
    project_path: str = ""
    worktree_path: str | None = None
    command_stem: str | None = None
    command_args: str | None = None
    prompt: str = ""
    branch: str | None = None
    effort: str | None = None
    skip_permissions: bool = False
    started_at: str | None = None
    ended_at: str | None = None
    duration_ms: float | None = None
    claude_session_id: str | None = None
    session_name: str | None = None
    total_cost_usd: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    num_turns: int | None = None
    error_message: str | None = None
    awaiting_input: bool = False


class CommandInfo(BaseModel):
    stem: str
    name: str
    description: str = ""
    source_path: str = ""
    type: str = "command"
    has_arguments: bool = False
