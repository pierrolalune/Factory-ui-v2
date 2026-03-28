"""Tests for Sprint 8 — Code review dependency graph endpoints."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from backend.services import code_review_service


class TestGetStats:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_project(self, client: AsyncClient):
        """GET /api/projects/{id}/code-review/stats returns 404 for unknown project."""
        resp = await client.get("/api/projects/nonexistent/code-review/stats")
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_returns_not_built_when_no_graph(self, client: AsyncClient, tmp_path: Path):
        """GET stats returns built=false when no graph file exists."""
        projects_data = [{"id": "proj-cr-1", "name": "Test", "path": str(tmp_path), "created_at": "2026-01-01T00:00:00Z"}]
        projects_file = tmp_path / "projects.json"
        projects_file.write_text(json.dumps(projects_data), encoding="utf-8")

        with patch("backend.services.project_service.PROJECTS_FILE", projects_file):
            resp = await client.get("/api/projects/proj-cr-1/code-review/stats")

        assert resp.status_code == 200
        data = resp.json()
        assert data["built"] is False
        assert data["node_count"] == 0


class TestBuildGraph:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_project(self, client: AsyncClient):
        """POST /api/projects/{id}/code-review/build returns 404 for unknown project."""
        resp = await client.post("/api/projects/nonexistent/code-review/build")
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_returns_400_not_git_repo(self, client: AsyncClient, tmp_path: Path):
        """POST build returns 400 when project is not a git repo."""
        projects_data = [{"id": "proj-cr-2", "name": "Test", "path": str(tmp_path), "created_at": "2026-01-01T00:00:00Z"}]
        projects_file = tmp_path / "projects.json"
        projects_file.write_text(json.dumps(projects_data), encoding="utf-8")

        with patch("backend.services.project_service.PROJECTS_FILE", projects_file):
            resp = await client.post("/api/projects/proj-cr-2/code-review/build")

        assert resp.status_code == 400


class TestGetGraphData:
    @pytest.mark.anyio
    async def test_returns_400_when_graph_not_built(self, client: AsyncClient, tmp_path: Path):
        """POST graph-data returns 400 when graph has not been built."""
        projects_data = [{"id": "proj-cr-3", "name": "Test", "path": str(tmp_path), "created_at": "2026-01-01T00:00:00Z"}]
        projects_file = tmp_path / "projects.json"
        projects_file.write_text(json.dumps(projects_data), encoding="utf-8")

        with patch("backend.services.project_service.PROJECTS_FILE", projects_file):
            resp = await client.post("/api/projects/proj-cr-3/code-review/graph-data", json={})

        assert resp.status_code == 400


class TestCodeReviewService:
    def test_get_stats_returns_not_built_for_empty_dir(self, tmp_path: Path):
        """get_stats returns built=False when no graph file exists."""
        stats = code_review_service.get_stats(str(tmp_path))
        assert stats.built is False

    def test_build_graph_raises_on_non_git_dir(self, tmp_path: Path):
        """build_graph raises ValueError('not_a_git_repo') for non-git directory."""
        with pytest.raises(ValueError, match="not_a_git_repo"):
            code_review_service.build_graph(str(tmp_path))

    def test_build_graph_creates_graph_file(self, tmp_path: Path):
        """build_graph creates a graph.json file for a git repo."""
        (tmp_path / ".git").mkdir()
        # Create a simple Python file with an import
        src = tmp_path / "main.py"
        utils = tmp_path / "utils.py"
        src.write_text("from utils import helper\n", encoding="utf-8")
        utils.write_text("def helper(): pass\n", encoding="utf-8")

        stats = code_review_service.build_graph(str(tmp_path))
        assert stats.built is True
        graph_file = tmp_path / ".code-review-graph" / "graph.json"
        assert graph_file.exists()

    def test_get_graph_data_raises_when_not_built(self, tmp_path: Path):
        """get_graph_data raises ValueError when graph not built."""
        with pytest.raises(ValueError, match="graph_not_built"):
            code_review_service.get_graph_data(str(tmp_path))

    def test_get_impact_returns_affected_files(self, tmp_path: Path):
        """get_impact returns files that depend on changed files."""
        (tmp_path / ".git").mkdir()
        # auth.py imported by middleware.py
        (tmp_path / "auth.py").write_text("def check(): pass\n", encoding="utf-8")
        (tmp_path / "middleware.py").write_text("from auth import check\n", encoding="utf-8")

        code_review_service.build_graph(str(tmp_path))
        result = code_review_service.get_impact(str(tmp_path), ["auth.py"])
        assert "middleware.py" in result.affected_files
