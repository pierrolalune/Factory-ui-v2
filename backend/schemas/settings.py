from pydantic import BaseModel


class PricingConfig(BaseModel):
    opus_input: float = 15.0
    opus_output: float = 75.0
    sonnet_input: float = 3.0
    sonnet_output: float = 15.0
    haiku_input: float = 0.8
    haiku_output: float = 4.0


class Settings(BaseModel):
    github_token: str | None = None
    github_username: str | None = None
    github_token_valid: bool | None = None
    default_model: str = "claude-sonnet-4-6"
    skip_permissions: bool = False
    worktree_base_path: str | None = None
    pricing: PricingConfig = PricingConfig()
