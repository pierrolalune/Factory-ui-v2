"""Tests for git service and router."""

import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app
from backend.services import git_service


def _init_git_repo(path: Path) -> None:
    """Initialize a git repo with a commit for testing."""
    subprocess.run(["git", "init"], cwd=path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=path, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=path, capture_output=True)
    # Create initial commit so HEAD exists
    (path / "README.md").write_text("# Test repo")
    subprocess.run(["git", "add", "-A"], cwd=path, capture_output=True)
    subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=path, capture_output=True)


def _make_projects_client(projects_file: Path, projects_dir: Path):
    return _ProjCtx(projects_file, projects_dir)


class _ProjCtx:
    def __init__(self, pf: Path, pd: Path):
        self._pf = pf
        self._pd = pd

    async def __aenter__(self):
        with (
            patch("backend.services.project_service.PROJECTS_FILE", self._pf),
            patch("backend.services.project_service.PROJECTS_DIR", self._pd),
        ):
            transport = ASGITransport(app=app)
            self._ac = AsyncClient(transport=transport, base_url="http://test")
            return await self._ac.__aenter__()

    async def __aexit__(self, *args):
        await self._ac.__aexit__(*args)


class TestGetStatus:
    def test_get_status_clean_repo(self, tmp_path: Path):
        """get_status returns branch name on a clean repo."""
        _init_git_repo(tmp_path)
        status = git_service.get_status(str(tmp_path))
        assert status.branch in ("main", "master")
        assert status.is_dirty is False
        assert status.staged == []
        assert status.unstaged == []
        assert status.untracked == []

    def test_get_status_with_untracked(self, tmp_path: Path):
        """Untracked files appear in status.untracked."""
        _init_git_repo(tmp_path)
        (tmp_path / "new_file.py").write_text("print('hello')")
        status = git_service.get_status(str(tmp_path))
        assert status.is_dirty is True
        assert "new_file.py" in status.untracked

    def test_get_status_with_modified(self, tmp_path: Path):
        """Modified tracked file appears in status.unstaged."""
        _init_git_repo(tmp_path)
        (tmp_path / "README.md").write_text("# Modified")
        status = git_service.get_status(str(tmp_path))
        assert status.is_dirty is True
        paths = [f.path for f in status.unstaged]
        assert "README.md" in paths

    def test_get_status_with_staged_file(self, tmp_path: Path):
        """Staged file appears in status.staged."""
        _init_git_repo(tmp_path)
        (tmp_path / "README.md").write_text("# Staged change")
        subprocess.run(["git", "add", "README.md"], cwd=tmp_path, capture_output=True)
        status = git_service.get_status(str(tmp_path))
        staged_paths = [f.path for f in status.staged]
        assert "README.md" in staged_paths


class TestStageUnstage:
    def test_stage_file(self, tmp_path: Path):
        """stage_files stages a file correctly."""
        _init_git_repo(tmp_path)
        f = tmp_path / "staged.py"
        f.write_text("x = 1")
        git_service.stage_files(str(tmp_path), ["staged.py"])
        status = git_service.get_status(str(tmp_path))
        staged_paths = [c.path for c in status.staged]
        assert "staged.py" in staged_paths

    def test_unstage_file(self, tmp_path: Path):
        """unstage_files moves a staged file back to unstaged."""
        _init_git_repo(tmp_path)
        f = tmp_path / "will_unstage.py"
        f.write_text("y = 2")
        git_service.stage_files(str(tmp_path), ["will_unstage.py"])
        git_service.unstage_files(str(tmp_path), ["will_unstage.py"])
        status = git_service.get_status(str(tmp_path))
        staged_paths = [c.path for c in status.staged]
        assert "will_unstage.py" not in staged_paths
        assert "will_unstage.py" in status.untracked


class TestCommit:
    def test_commit_creates_commit(self, tmp_path: Path):
        """commit creates a new git commit."""
        _init_git_repo(tmp_path)
        (tmp_path / "feat.py").write_text("def foo(): pass")
        git_service.stage_files(str(tmp_path), ["feat.py"])
        result = git_service.commit(str(tmp_path), "feat: add foo")
        assert "hash" in result
        assert "message" in result

    def test_commit_updates_log(self, tmp_path: Path):
        """After commit, get_log shows the new commit."""
        _init_git_repo(tmp_path)
        (tmp_path / "bar.py").write_text("x = 42")
        git_service.stage_files(str(tmp_path), ["bar.py"])
        git_service.commit(str(tmp_path), "feat: add bar")
        logs = git_service.get_log(str(tmp_path), limit=5)
        messages = [c.message for c in logs]
        assert "feat: add bar" in messages


class TestGetLog:
    def test_get_log_returns_commits(self, tmp_path: Path):
        """get_log returns commit history."""
        _init_git_repo(tmp_path)
        logs = git_service.get_log(str(tmp_path))
        assert len(logs) >= 1
        assert logs[0].hash
        assert logs[0].message
        assert logs[0].author
        assert logs[0].date

    def test_get_log_respects_limit(self, tmp_path: Path):
        """get_log respects the limit parameter."""
        _init_git_repo(tmp_path)
        # Add more commits
        for i in range(5):
            (tmp_path / f"file{i}.py").write_text(f"x = {i}")
            subprocess.run(["git", "add", f"file{i}.py"], cwd=tmp_path, capture_output=True)
            subprocess.run(["git", "commit", "-m", f"commit {i}"], cwd=tmp_path, capture_output=True)
        logs = git_service.get_log(str(tmp_path), limit=3)
        assert len(logs) <= 3


class TestGetDiff:
    def test_get_diff_unstaged(self, tmp_path: Path):
        """get_diff returns diff for unstaged changes."""
        _init_git_repo(tmp_path)
        (tmp_path / "README.md").write_text("# Changed\n\nNew content")
        diff = git_service.get_diff(str(tmp_path), "README.md", staged=False)
        assert diff.file_path == "README.md"
        assert diff.is_staged is False
        assert diff.is_binary is False
        assert len(diff.hunks) > 0

    def test_get_diff_staged(self, tmp_path: Path):
        """get_diff returns diff for staged changes."""
        _init_git_repo(tmp_path)
        (tmp_path / "README.md").write_text("# Staged change\n\nSome text")
        subprocess.run(["git", "add", "README.md"], cwd=tmp_path, capture_output=True)
        diff = git_service.get_diff(str(tmp_path), "README.md", staged=True)
        assert diff.is_staged is True
        assert len(diff.hunks) > 0

    def test_get_diff_binary_extension(self, tmp_path: Path):
        """get_diff returns is_binary=True for binary file extensions."""
        _init_git_repo(tmp_path)
        (tmp_path / "image.png").write_bytes(b"\x89PNG\r\n")
        diff = git_service.get_diff(str(tmp_path), "image.png", staged=False)
        assert diff.is_binary is True
        assert diff.hunks == []


class TestGitRouterIntegration:
    @pytest.mark.anyio
    async def test_get_status_endpoint(self, tmp_path: Path):
        """GET /api/projects/{id}/git/status returns 200."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "my-repo"
        project_dir.mkdir()
        _init_git_repo(project_dir)

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                r = await ac.post("/api/projects", json={"name": "MyRepo", "path": str(project_dir)})
                pid = r.json()["id"]
                resp = await ac.get(f"/api/projects/{pid}/git/status")

        assert resp.status_code == 200
        data = resp.json()
        assert "branch" in data
        assert "is_dirty" in data

    @pytest.mark.anyio
    async def test_stage_endpoint(self, tmp_path: Path):
        """POST /api/projects/{id}/git/stage stages a file."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "stage-repo"
        project_dir.mkdir()
        _init_git_repo(project_dir)
        (project_dir / "new.py").write_text("x = 1")

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                r = await ac.post("/api/projects", json={"name": "Stage", "path": str(project_dir)})
                pid = r.json()["id"]
                resp = await ac.post(f"/api/projects/{pid}/git/stage", json={"paths": ["new.py"]})

        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    @pytest.mark.anyio
    async def test_commit_endpoint(self, tmp_path: Path):
        """POST /api/projects/{id}/git/commit commits staged changes."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "commit-repo"
        project_dir.mkdir()
        _init_git_repo(project_dir)
        (project_dir / "new.py").write_text("x = 1")
        subprocess.run(["git", "add", "new.py"], cwd=project_dir, capture_output=True)

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                r = await ac.post("/api/projects", json={"name": "Commit", "path": str(project_dir)})
                pid = r.json()["id"]
                resp = await ac.post(f"/api/projects/{pid}/git/commit", json={"message": "feat: add new"})

        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_log_endpoint(self, tmp_path: Path):
        """GET /api/projects/{id}/git/log returns commit list."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "log-repo"
        project_dir.mkdir()
        _init_git_repo(project_dir)

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                r = await ac.post("/api/projects", json={"name": "Log", "path": str(project_dir)})
                pid = r.json()["id"]
                resp = await ac.get(f"/api/projects/{pid}/git/log")

        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
