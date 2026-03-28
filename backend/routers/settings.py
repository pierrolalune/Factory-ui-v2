"""Settings router — GET/PATCH /api/settings + GitHub token endpoints."""

from fastapi import APIRouter, HTTPException

from backend.schemas.settings import GitHubTokenRequest, SettingsResponse, UpdateSettingsRequest
from backend.services import settings_service

router = APIRouter()


@router.get("", response_model=SettingsResponse)
async def get_settings() -> SettingsResponse:
    """Return current settings with masked GitHub token."""
    return settings_service.get_settings()


@router.patch("", response_model=SettingsResponse)
async def patch_settings(body: UpdateSettingsRequest) -> SettingsResponse:
    """Partially update settings. Ignores empty github_token."""
    updates = body.model_dump(exclude_unset=True)
    return settings_service.update_settings(updates)


@router.post("/github/token")
async def save_github_token(body: GitHubTokenRequest) -> dict:
    """Validate and store a GitHub PAT."""
    try:
        return await settings_service.validate_and_save_github_token(body.token)
    except ValueError:
        raise HTTPException(status_code=400, detail={"detail": "Invalid token", "code": "invalid_token"})


@router.delete("/github/token")
async def delete_github_token() -> dict:
    """Remove the stored GitHub token."""
    settings_service.delete_github_token()
    return {"ok": True}
