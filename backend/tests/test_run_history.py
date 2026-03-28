"""Tests for Sprint 6 — Run History endpoints (GET /api/runs/{id}, output, delete)."""

import gzip
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient


class TestGetRun:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_run(self, client: AsyncClient):
        """GET /api/runs/{id} returns 404 for an unknown run ID."""
        resp = await client.get("/api/runs/nonexistent-run-id")
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_returns_run_when_exists(self, client: AsyncClient, tmp_path: Path):
        """GET /api/runs/{id} returns run data when a run JSON file exists."""
        project_id = "test-proj-001"
        run_id = "run-abc-123"
        run_dir = tmp_path / project_id / "runs"
        run_dir.mkdir(parents=True)

        run_data = {
            "run_id": run_id,
            "project_id": project_id,
            "project_name": "Test Project",
            "project_path": "/tmp/test",
            "type": "command",
            "status": "completed",
            "prompt": "/polisher src/",
            "skip_permissions": False,
            "started_at": "2026-03-28T10:00:00Z",
            "awaiting_input": False,
        }
        (run_dir / f"{run_id}.json").write_text(json.dumps(run_data), encoding="utf-8")

        with patch("backend.routers.runs.PROJECTS_DIR", tmp_path):
            resp = await client.get(f"/api/runs/{run_id}")

        assert resp.status_code == 200
        data = resp.json()
        assert data["run_id"] == run_id
        assert data["status"] == "completed"


class TestGetRunOutput:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_run(self, client: AsyncClient):
        """GET /api/runs/{id}/output returns 404 for unknown run."""
        resp = await client.get("/api/runs/unknown-run-id/output")
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_returns_empty_when_no_output(self, client: AsyncClient, tmp_path: Path):
        """GET /api/runs/{id}/output returns empty data when no output file exists."""
        project_id = "test-proj-002"
        run_id = "run-no-output"
        run_dir = tmp_path / project_id / "runs"
        run_dir.mkdir(parents=True)

        run_data = {
            "run_id": run_id,
            "project_id": project_id,
            "project_name": "P",
            "project_path": "/tmp/p",
            "type": "command",
            "status": "completed",
            "prompt": "/test",
            "skip_permissions": False,
            "started_at": "2026-03-28T10:00:00Z",
            "awaiting_input": False,
        }
        (run_dir / f"{run_id}.json").write_text(json.dumps(run_data), encoding="utf-8")

        with patch("backend.routers.runs.PROJECTS_DIR", tmp_path):
            resp = await client.get(f"/api/runs/{run_id}/output")

        assert resp.status_code == 200
        assert resp.json()["data"] == ""

    @pytest.mark.anyio
    async def test_returns_base64_output(self, client: AsyncClient, tmp_path: Path):
        """GET /api/runs/{id}/output returns base64-encoded PTY output."""
        import base64

        project_id = "test-proj-003"
        run_id = "run-has-output"
        run_dir = tmp_path / project_id / "runs"
        run_dir.mkdir(parents=True)

        run_data = {
            "run_id": run_id,
            "project_id": project_id,
            "project_name": "P",
            "project_path": "/tmp/p",
            "type": "command",
            "status": "completed",
            "prompt": "/test",
            "skip_permissions": False,
            "started_at": "2026-03-28T10:00:00Z",
            "awaiting_input": False,
        }
        (run_dir / f"{run_id}.json").write_text(json.dumps(run_data), encoding="utf-8")

        raw_output = b"Hello from terminal\r\n"
        (run_dir / f"{run_id}.output.gz").write_bytes(gzip.compress(raw_output))

        with (
            patch("backend.routers.runs.PROJECTS_DIR", tmp_path),
            patch("backend.services.run_output_service.PROJECTS_DIR", tmp_path),
        ):
            resp = await client.get(f"/api/runs/{run_id}/output")

        assert resp.status_code == 200
        decoded = base64.b64decode(resp.json()["data"])
        assert decoded == raw_output


class TestDeleteRun:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_run(self, client: AsyncClient):
        """DELETE /api/runs/{id} returns 404 for unknown run."""
        resp = await client.delete("/api/runs/unknown-run")
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_deletes_run_and_output(self, client: AsyncClient, tmp_path: Path):
        """DELETE /api/runs/{id} removes the JSON and output files."""
        project_id = "test-proj-del"
        run_id = "run-to-delete"
        run_dir = tmp_path / project_id / "runs"
        run_dir.mkdir(parents=True)

        run_data = {
            "run_id": run_id,
            "project_id": project_id,
            "project_name": "P",
            "project_path": "/tmp/p",
            "type": "command",
            "status": "completed",
            "prompt": "/test",
            "skip_permissions": False,
            "started_at": "2026-03-28T10:00:00Z",
            "awaiting_input": False,
        }
        json_file = run_dir / f"{run_id}.json"
        output_file = run_dir / f"{run_id}.output.gz"
        json_file.write_text(json.dumps(run_data), encoding="utf-8")
        output_file.write_bytes(gzip.compress(b"output"))

        with patch("backend.routers.runs.PROJECTS_DIR", tmp_path):
            resp = await client.delete(f"/api/runs/{run_id}")

        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert not json_file.exists()
        assert not output_file.exists()
