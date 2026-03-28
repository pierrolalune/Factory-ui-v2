"""Tests for worktree service and router."""

import json
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app
from backend.schemas.worktree import WorktreeCreate
from backend.services import worktree_service


def _init_git_repo(path: Path) -> str:
    """Initialize a git repo and return the default branch name."""
    subprocess.run(["git", "init"], cwd=path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=path, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=path, capture_output=True)
    (path / "README.md").write_text("# Test repo")
    subprocess.run(["git", "add", "-A"], cwd=path, capture_output=True)
    subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=path, capture_output=True)
    r = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=path, capture_output=True, text=True)
    return r.stdout.strip() or "master"


class TestListWorktrees:
    def test_list_returns_empty_initially(self, tmp_path: Path):
        """list_worktrees returns [] when worktrees.json does not exist."""
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        with patch("backend.services.worktree_service.PROJECTS_DIR", pd):
            result = worktree_service.list_worktrees("some-project-id")
        assert result == []

    def test_list_persists_across_calls(self, tmp_path: Path):
        """list_worktrees returns items stored in worktrees.json."""
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_id = "test-proj"
        (pd / project_id).mkdir()
        # Write a fake worktrees.json
        wt = {
            "id": "wt-feat-test-abc123",
            "project_id": project_id,
            "branch": "feat/test",
            "path": str(tmp_path / "worktrees" / "feat-test"),
            "base_branch": "main",
            "created_at": "2026-01-01T00:00:00+00:00",
            "is_dirty": False,
            "ahead": 0,
            "commit_sha": None,
        }
        (pd / project_id / "worktrees.json").write_text(json.dumps([wt]))

        with patch("backend.services.worktree_service.PROJECTS_DIR", pd):
            result = worktree_service.list_worktrees(project_id)
        assert len(result) == 1
        assert result[0].branch == "feat/test"


class TestCreateWorktree:
    def test_create_worktree_success(self, tmp_path: Path):
        """create_worktree adds a new worktree and registers it."""
        project_dir = tmp_path / "my-app"
        project_dir.mkdir()
        base_branch = _init_git_repo(project_dir)

        pd = tmp_path / "factory-projects"
        pd.mkdir()
        pf = tmp_path / "projects.json"

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
            patch("backend.services.worktree_service.PROJECTS_DIR", pd),
        ):
            from backend.schemas.project import ProjectCreate
            from backend.services import project_service
            result = project_service.create_project(
                ProjectCreate(name="MyApp", path=str(project_dir))
            )
            project_id = result["id"]

            data = WorktreeCreate(branch="feat/login", base_branch=base_branch, create_branch=True)
            wt_result = worktree_service.create_worktree(project_id, data)

        assert "id" in wt_result
        assert wt_result["id"].startswith("wt-")
        assert "path" in wt_result

    def test_create_worktree_invalid_branch_name(self, tmp_path: Path):
        """create_worktree raises ValueError for invalid branch names."""
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        pf = tmp_path / "projects.json"
        project_dir = tmp_path / "app"
        project_dir.mkdir()
        base_branch = _init_git_repo(project_dir)

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
            patch("backend.services.worktree_service.PROJECTS_DIR", pd),
        ):
            from backend.schemas.project import ProjectCreate
            from backend.services import project_service
            result = project_service.create_project(
                ProjectCreate(name="App", path=str(project_dir))
            )
            project_id = result["id"]

            with pytest.raises(ValueError, match="invalid_branch_name"):
                worktree_service.create_worktree(
                    project_id, WorktreeCreate(branch="bad name", base_branch=base_branch)
                )


class TestDeleteWorktree:
    def test_delete_worktree_removes_from_json(self, tmp_path: Path):
        """delete_worktree removes the worktree entry from worktrees.json."""
        project_dir = tmp_path / "del-app"
        project_dir.mkdir()
        base_branch = _init_git_repo(project_dir)

        pd = tmp_path / "factory-projects"
        pd.mkdir()
        pf = tmp_path / "projects.json"

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
            patch("backend.services.worktree_service.PROJECTS_DIR", pd),
        ):
            from backend.schemas.project import ProjectCreate
            from backend.services import project_service
            r = project_service.create_project(ProjectCreate(name="DelApp", path=str(project_dir)))
            project_id = r["id"]

            # Create worktree
            data = WorktreeCreate(branch="feat/to-delete", base_branch=base_branch, create_branch=True)
            wt_result = worktree_service.create_worktree(project_id, data)
            wt_id = wt_result["id"]

            # Verify it exists
            wts = worktree_service.list_worktrees(project_id)
            assert any(wt.id == wt_id for wt in wts)

            # Delete it
            worktree_service.delete_worktree(project_id, wt_id)

            # Should be gone
            wts_after = worktree_service.list_worktrees(project_id)
            assert not any(wt.id == wt_id for wt in wts_after)

    def test_delete_nonexistent_raises(self, tmp_path: Path):
        """delete_worktree raises FileNotFoundError for missing worktree."""
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        pf = tmp_path / "projects.json"
        project_dir = tmp_path / "app"
        project_dir.mkdir()
        _init_git_repo(project_dir)  # noqa: F841 — side effect only

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
            patch("backend.services.worktree_service.PROJECTS_DIR", pd),
        ):
            from backend.schemas.project import ProjectCreate
            from backend.services import project_service
            r = project_service.create_project(ProjectCreate(name="App", path=str(project_dir)))
            project_id = r["id"]

            with pytest.raises(FileNotFoundError):
                worktree_service.delete_worktree(project_id, "wt-nonexistent-abc123")


class TestWorktreesRouterIntegration:
    @pytest.mark.anyio
    async def test_list_worktrees_empty(self, tmp_path: Path):
        """GET /api/projects/{id}/worktrees returns [] initially."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "api-app"
        project_dir.mkdir()
        _init_git_repo(project_dir)

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
            patch("backend.services.worktree_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                r = await ac.post("/api/projects", json={"name": "ApiApp", "path": str(project_dir)})
                pid = r.json()["id"]
                resp = await ac.get(f"/api/projects/{pid}/worktrees")

        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.anyio
    async def test_create_and_list_worktree(self, tmp_path: Path):
        """POST then GET /api/projects/{id}/worktrees shows the new worktree."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "wt-app"
        project_dir.mkdir()
        base_branch = _init_git_repo(project_dir)

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
            patch("backend.services.worktree_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                r = await ac.post("/api/projects", json={"name": "WtApp", "path": str(project_dir)})
                pid = r.json()["id"]

                create_resp = await ac.post(
                    f"/api/projects/{pid}/worktrees",
                    json={"branch": "feat/api-test", "base_branch": base_branch, "create_branch": True},
                )
                assert create_resp.status_code == 200
                assert "id" in create_resp.json()

                list_resp = await ac.get(f"/api/projects/{pid}/worktrees")
                assert list_resp.status_code == 200
                wts = list_resp.json()
                assert len(wts) == 1
                assert wts[0]["branch"] == "feat/api-test"
