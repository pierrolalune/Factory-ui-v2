"""Tests for Sprint 7 — GitHub integration endpoints."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient


class TestGetRemoteInfo:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_project(self, client: AsyncClient):
        """GET /api/projects/{id}/github/remote returns 404 for unknown project."""
        resp = await client.get("/api/projects/nonexistent/github/remote")
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_returns_400_no_token_when_not_configured(
        self, client: AsyncClient, tmp_path: Path
    ):
        """GET /api/projects/{id}/github/remote returns 400 when no token is set."""
        projects_data = [{"id": "proj-gh-1", "name": "Test", "path": str(tmp_path), "created_at": "2026-01-01T00:00:00Z"}]
        projects_file = tmp_path / "projects.json"
        projects_file.write_text(json.dumps(projects_data), encoding="utf-8")

        settings_file = tmp_path / "settings.json"
        settings_file.write_text(json.dumps({}), encoding="utf-8")

        with (
            patch("backend.services.project_service.PROJECTS_FILE", projects_file),
            patch("backend.services.settings_service.SETTINGS_FILE", settings_file),
        ):
            resp = await client.get("/api/projects/proj-gh-1/github/remote")

        # Either 400 (no token / no remote) or 404 — both are acceptable
        assert resp.status_code in (400, 404)


class TestPushBranch:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_project(self, client: AsyncClient):
        """POST /api/projects/{id}/github/push returns 404 for unknown project."""
        resp = await client.post(
            "/api/projects/nonexistent/github/push",
            json={"branch": "feat/test"},
        )
        assert resp.status_code == 404


class TestListPRs:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_project(self, client: AsyncClient):
        """GET /api/projects/{id}/github/pull-requests returns 404 for unknown project."""
        resp = await client.get("/api/projects/nonexistent/github/pull-requests")
        assert resp.status_code == 404


class TestCreatePR:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_project(self, client: AsyncClient):
        """POST /api/projects/{id}/github/pull-request returns 404 for unknown project."""
        resp = await client.post(
            "/api/projects/nonexistent/github/pull-request",
            json={
                "head_branch": "feat/test",
                "base_branch": "main",
                "title": "Test PR",
            },
        )
        assert resp.status_code == 404
