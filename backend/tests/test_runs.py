"""Tests for GET /api/runs endpoint — written first (RED phase)."""

import pytest
from httpx import AsyncClient


class TestListRuns:
    @pytest.mark.anyio
    async def test_returns_empty_list(self, client: AsyncClient):
        """GET /api/runs returns an empty list when no runs exist."""
        resp = await client.get("/api/runs")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.anyio
    async def test_status_active_filter_returns_empty_list(self, client: AsyncClient):
        """GET /api/runs?status=active returns [] when no active runs exist."""
        resp = await client.get("/api/runs", params={"status": "active"})
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.anyio
    async def test_project_id_filter_returns_empty_list(self, client: AsyncClient):
        """GET /api/runs?project_id=anything returns [] for unknown project."""
        resp = await client.get("/api/runs", params={"project_id": "nonexistent-project"})
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.anyio
    async def test_limit_param_accepted(self, client: AsyncClient):
        """GET /api/runs?limit=10 is accepted and returns []."""
        resp = await client.get("/api/runs", params={"limit": 10})
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.anyio
    async def test_sort_param_accepted(self, client: AsyncClient):
        """GET /api/runs?sort=started_at_desc is accepted and returns []."""
        resp = await client.get("/api/runs", params={"sort": "started_at_desc"})
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.anyio
    async def test_combined_params_accepted(self, client: AsyncClient):
        """GET /api/runs with all params combined returns []."""
        resp = await client.get(
            "/api/runs",
            params={"limit": 10, "sort": "started_at_desc", "status": "completed"},
        )
        assert resp.status_code == 200
        assert resp.json() == []
