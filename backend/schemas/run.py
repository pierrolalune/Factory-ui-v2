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
