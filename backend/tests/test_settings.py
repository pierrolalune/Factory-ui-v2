"""Tests for settings service and router — written first (RED phase)."""

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app


def make_settings_client(settings_file: Path):
    """Return an ASGI client with SETTINGS_FILE patched to a tmp file."""

    async def _client():
        with patch("backend.services.settings_service.SETTINGS_FILE", settings_file):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac

    return _client


class TestGetSettings:
    @pytest.mark.anyio
    async def test_returns_defaults_when_file_missing(self, tmp_path: Path):
        """When no settings file exists, defaults should be returned."""
        sf = tmp_path / "factory-cli.json"
        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["github_token_set"] is False
        assert data["default_model"] == "claude-sonnet-4-6"
        assert data["skip_permissions"] is False
        assert "pricing" in data
        assert data["pricing"]["sonnet_input"] == 3.0

    @pytest.mark.anyio
    async def test_returns_masked_token_when_set(self, tmp_path: Path):
        """A stored token should be masked (first 4 + last 4 chars)."""
        sf = tmp_path / "factory-cli.json"
        sf.write_text(
            json.dumps({"github_token": "ghp_1234567890abcdef", "github_username": "pierre"})
        )
        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["github_token_set"] is True
        masked = data["github_token_masked"]
        # First 4 chars visible, last 4 chars visible
        assert masked.startswith("ghp_")
        assert masked.endswith("cdef")
        assert "****" in masked
        assert data["github_username"] == "pierre"

    @pytest.mark.anyio
    async def test_no_github_fields_when_token_not_set(self, tmp_path: Path):
        """When no token is stored, github_token_masked is None or absent."""
        sf = tmp_path / "factory-cli.json"
        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/settings")
        data = resp.json()
        assert data["github_token_set"] is False
        assert data.get("github_token_masked") is None


class TestPatchSettings:
    @pytest.mark.anyio
    async def test_patch_updates_model(self, tmp_path: Path):
        """PATCH should update specified fields and return updated settings."""
        sf = tmp_path / "factory-cli.json"
        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.patch("/api/settings", json={"default_model": "claude-opus-4-6"})
        assert resp.status_code == 200
        assert resp.json()["default_model"] == "claude-opus-4-6"

    @pytest.mark.anyio
    async def test_patch_ignores_empty_github_token(self, tmp_path: Path):
        """Empty github_token in PATCH must not overwrite an existing token."""
        sf = tmp_path / "factory-cli.json"
        sf.write_text(
            json.dumps({"github_token": "ghp_existingtoken1234", "github_username": "user"})
        )
        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.patch("/api/settings", json={"github_token": ""})
        assert resp.status_code == 200
        saved = json.loads(sf.read_text())
        assert saved["github_token"] == "ghp_existingtoken1234"

    @pytest.mark.anyio
    async def test_patch_updates_pricing(self, tmp_path: Path):
        """PATCH should support nested pricing update."""
        sf = tmp_path / "factory-cli.json"
        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.patch("/api/settings", json={"pricing": {"sonnet_input": 5.0}})
        assert resp.status_code == 200
        assert resp.json()["pricing"]["sonnet_input"] == 5.0

    @pytest.mark.anyio
    async def test_patch_skip_permissions(self, tmp_path: Path):
        """PATCH should toggle skip_permissions."""
        sf = tmp_path / "factory-cli.json"
        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.patch("/api/settings", json={"skip_permissions": True})
        assert resp.status_code == 200
        assert resp.json()["skip_permissions"] is True


class TestGitHubToken:
    @pytest.mark.anyio
    async def test_post_token_valid(self, tmp_path: Path):
        """POST /api/settings/github/token with valid token stores and returns username."""
        sf = tmp_path / "factory-cli.json"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"login": "pierre"}

        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            with patch("backend.services.settings_service.httpx.AsyncClient") as mock_cls:
                mock_http = AsyncMock()
                mock_http.__aenter__ = AsyncMock(return_value=mock_http)
                mock_http.__aexit__ = AsyncMock(return_value=False)
                mock_http.get = AsyncMock(return_value=mock_resp)
                mock_cls.return_value = mock_http

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as ac:
                    resp = await ac.post(
                        "/api/settings/github/token",
                        json={"token": "ghp_validtoken12345678"},
                    )

        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "pierre"
        assert data["valid"] is True

    @pytest.mark.anyio
    async def test_post_token_invalid(self, tmp_path: Path):
        """POST with invalid token should return 400."""
        sf = tmp_path / "factory-cli.json"
        mock_resp = MagicMock()
        mock_resp.status_code = 401

        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            with patch("backend.services.settings_service.httpx.AsyncClient") as mock_cls:
                mock_http = AsyncMock()
                mock_http.__aenter__ = AsyncMock(return_value=mock_http)
                mock_http.__aexit__ = AsyncMock(return_value=False)
                mock_http.get = AsyncMock(return_value=mock_resp)
                mock_cls.return_value = mock_http

                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as ac:
                    resp = await ac.post(
                        "/api/settings/github/token",
                        json={"token": "ghp_bad"},
                    )

        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "invalid_token"

    @pytest.mark.anyio
    async def test_delete_token_removes_it(self, tmp_path: Path):
        """DELETE /api/settings/github/token clears token and username."""
        sf = tmp_path / "factory-cli.json"
        sf.write_text(
            json.dumps({"github_token": "ghp_sometoken", "github_username": "pierre"})
        )
        with patch("backend.services.settings_service.SETTINGS_FILE", sf):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.delete("/api/settings/github/token")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        saved = json.loads(sf.read_text())
        assert saved.get("github_token") is None
        assert saved.get("github_username") is None


class TestTokenMasking:
    def test_mask_short_token(self):
        """Token shorter than 8 chars should be fully masked."""
        from backend.services.settings_service import mask_token

        assert mask_token("abc") == "****"

    def test_mask_long_token(self):
        """Token >= 8 chars should show first 4 and last 4."""
        from backend.services.settings_service import mask_token

        result = mask_token("ghp_1234567890abcdef")
        assert result.startswith("ghp_")
        assert result.endswith("cdef")
        assert "****" in result
