"""Settings service — read/write ~/.factory-cli.json."""

import json
import logging
from pathlib import Path

import httpx

from backend.schemas.settings import PricingConfig, Settings, SettingsResponse

logger = logging.getLogger("factory")

# Patched in tests via monkeypatch / unittest.mock.patch
SETTINGS_FILE: Path = Path.home() / ".factory-cli.json"


def mask_token(token: str) -> str:
    """Return a masked version of a token: first 4 + '****...' + last 4."""
    if len(token) < 8:
        return "****"
    return f"{token[:4]}****...****{token[-4:]}"


def _load() -> Settings:
    """Load settings from disk, returning defaults if the file is absent."""
    if not SETTINGS_FILE.exists():
        return Settings()
    try:
        data = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        return Settings.model_validate(data)
    except Exception as exc:
        logger.warning("Failed to parse settings file: %s", exc)
        return Settings()


def _save(settings: Settings) -> None:
    """Write settings to disk, excluding None values."""
    SETTINGS_FILE.write_text(
        json.dumps(settings.model_dump(exclude_none=False), indent=2),
        encoding="utf-8",
    )


def _to_response(settings: Settings) -> SettingsResponse:
    """Convert internal Settings to the public SettingsResponse (masked token)."""
    resp = SettingsResponse(
        github_token_set=bool(settings.github_token),
        github_username=settings.github_username,
        github_token_valid=settings.github_token_valid,
        default_model=settings.default_model,
        skip_permissions=settings.skip_permissions,
        worktree_base_path=settings.worktree_base_path,
        pricing=settings.pricing,
    )
    if settings.github_token:
        resp.github_token_masked = mask_token(settings.github_token)
    return resp


def get_settings() -> SettingsResponse:
    """Read and return masked settings."""
    return _to_response(_load())


def update_settings(data: dict) -> SettingsResponse:
    """Apply a partial update dict to settings and persist."""
    settings = _load()
    # Never overwrite a token with an empty string — use DELETE endpoint
    if "github_token" in data and not data["github_token"]:
        data.pop("github_token")

    if "pricing" in data and isinstance(data["pricing"], dict):
        current = settings.pricing.model_dump()
        current.update(data["pricing"])
        data["pricing"] = PricingConfig.model_validate(current)

    for key, value in data.items():
        if hasattr(settings, key) and value is not None:
            setattr(settings, key, value)

    _save(settings)
    return _to_response(settings)


async def validate_and_save_github_token(token: str) -> dict:
    """Validate a GitHub PAT against the API, store on success, raise on failure."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            timeout=10,
        )

    if resp.status_code != 200:
        raise ValueError("invalid_token")

    username = resp.json().get("login", "")
    settings = _load()
    settings.github_token = token
    settings.github_username = username
    settings.github_token_valid = True
    _save(settings)
    return {"username": username, "valid": True}


def delete_github_token() -> None:
    """Remove the GitHub token and cached username from settings."""
    settings = _load()
    settings.github_token = None
    settings.github_username = None
    settings.github_token_valid = None
    _save(settings)
