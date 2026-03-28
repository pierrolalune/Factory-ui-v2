"""Tests for project service and router — written first (RED phase)."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app


def make_client(projects_file: Path, projects_dir: Path):
    """Return an async context manager with storage paths patched."""
    return _ProjectsClient(projects_file, projects_dir)


class _ProjectsClient:
    def __init__(self, projects_file: Path, projects_dir: Path):
        self._pf = projects_file
        self._pd = projects_dir
        self._ctx = None

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


@pytest.fixture
def storage(tmp_path: Path):
    pf = tmp_path / "factory-cli-projects.json"
    pd = tmp_path / "factory-projects"
    pd.mkdir()
    return pf, pd


class TestListProjects:
    @pytest.mark.anyio
    async def test_returns_empty_list_initially(self, tmp_path: Path):
        """GET /api/projects returns [] when no projects registered."""
        pf = tmp_path / "factory-cli-projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/projects")
        assert resp.status_code == 200
        assert resp.json() == []


class TestCreateProject:
    @pytest.mark.anyio
    async def test_create_project(self, tmp_path: Path):
        """POST /api/projects creates and returns project id."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "my-app"
        project_dir.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.post("/api/projects", json={"name": "My App", "path": str(project_dir)})
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["id"].startswith("my-app-")

    @pytest.mark.anyio
    async def test_create_duplicate_path_returns_409(self, tmp_path: Path):
        """Creating a project with the same path twice returns 409."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "dup-app"
        project_dir.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                await ac.post("/api/projects", json={"name": "Dup App", "path": str(project_dir)})
                resp = await ac.post(
                    "/api/projects", json={"name": "Dup App 2", "path": str(project_dir)}
                )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "already_registered"

    @pytest.mark.anyio
    async def test_create_nonexistent_path_returns_400(self, tmp_path: Path):
        """POST with path that doesn't exist returns 400."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.post(
                    "/api/projects",
                    json={"name": "Ghost", "path": str(tmp_path / "does-not-exist")},
                )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "path_not_found"


class TestGetProject:
    @pytest.mark.anyio
    async def test_get_project_returns_project(self, tmp_path: Path):
        """GET /api/projects/{id} returns the project."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "get-app"
        project_dir.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                create_resp = await ac.post(
                    "/api/projects", json={"name": "Get App", "path": str(project_dir)}
                )
                pid = create_resp.json()["id"]
                resp = await ac.get(f"/api/projects/{pid}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Get App"

    @pytest.mark.anyio
    async def test_get_nonexistent_returns_404(self, tmp_path: Path):
        """GET /api/projects/unknown returns 404."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/projects/unknown-id")
        assert resp.status_code == 404


class TestDeleteProject:
    @pytest.mark.anyio
    async def test_delete_removes_project(self, tmp_path: Path):
        """DELETE /api/projects/{id} removes from registry."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "del-app"
        project_dir.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                create_resp = await ac.post(
                    "/api/projects", json={"name": "Del App", "path": str(project_dir)}
                )
                pid = create_resp.json()["id"]
                del_resp = await ac.delete(f"/api/projects/{pid}")
                assert del_resp.status_code == 200
                assert del_resp.json()["ok"] is True
                list_resp = await ac.get("/api/projects")
        ids = [p["id"] for p in list_resp.json()]
        assert pid not in ids

    @pytest.mark.anyio
    async def test_delete_does_not_touch_files(self, tmp_path: Path):
        """DELETE does not delete project directory on disk."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "safe-app"
        project_dir.mkdir()
        sentinel = project_dir / "sentinel.txt"
        sentinel.write_text("keep me")

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                create_resp = await ac.post(
                    "/api/projects", json={"name": "Safe App", "path": str(project_dir)}
                )
                pid = create_resp.json()["id"]
                await ac.delete(f"/api/projects/{pid}")
        assert sentinel.exists()


class TestValidatePath:
    @pytest.mark.anyio
    async def test_validate_existing_path(self, tmp_path: Path):
        """validate-path returns exists=True for real directory."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "validate-me"
        project_dir.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/projects/validate-path", params={"path": str(project_dir)})
        assert resp.status_code == 200
        data = resp.json()
        assert data["exists"] is True
        assert data["already_registered"] is False

    @pytest.mark.anyio
    async def test_validate_missing_path(self, tmp_path: Path):
        """validate-path returns exists=False for missing path."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get(
                    "/api/projects/validate-path",
                    params={"path": str(tmp_path / "ghost")},
                )
        assert resp.status_code == 200
        assert resp.json()["exists"] is False

    @pytest.mark.anyio
    async def test_validate_detects_git_repo(self, tmp_path: Path):
        """validate-path detects .git presence."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "git-project"
        project_dir.mkdir()
        (project_dir / ".git").mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/projects/validate-path", params={"path": str(project_dir)})
        assert resp.json()["is_git_repo"] is True

    @pytest.mark.anyio
    async def test_validate_detects_stack_node(self, tmp_path: Path):
        """validate-path detects Node.js stack from package.json."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "node-project"
        project_dir.mkdir()
        (project_dir / "package.json").write_text(
            json.dumps({"dependencies": {"react": "^18.0.0"}})
        )

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/projects/validate-path", params={"path": str(project_dir)})
        data = resp.json()
        assert "Node.js" in data["detected_stack"]
        assert "React" in data["detected_stack"]

    @pytest.mark.anyio
    async def test_validate_already_registered(self, tmp_path: Path):
        """validate-path reports already_registered if path is in registry."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "reg-project"
        project_dir.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                await ac.post("/api/projects", json={"name": "Reg", "path": str(project_dir)})
                resp = await ac.get("/api/projects/validate-path", params={"path": str(project_dir)})
        data = resp.json()
        assert data["already_registered"] is True
        assert "existing_project_id" in data


class TestFileTree:
    @pytest.mark.anyio
    async def test_file_tree_excludes_dot_git(self, tmp_path: Path):
        """file-tree must exclude .git and node_modules."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "tree-app"
        project_dir.mkdir()
        (project_dir / ".git").mkdir()
        (project_dir / "node_modules").mkdir()
        (project_dir / "src").mkdir()
        (project_dir / "src" / "index.ts").write_text("export {};")

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                create_resp = await ac.post(
                    "/api/projects", json={"name": "Tree App", "path": str(project_dir)}
                )
                pid = create_resp.json()["id"]
                resp = await ac.get(f"/api/projects/{pid}/file-tree")
        assert resp.status_code == 200
        tree = resp.json()
        names = [node["name"] for node in tree]
        assert ".git" not in names
        assert "node_modules" not in names
        assert "src" in names


class TestReadFile:
    @pytest.mark.anyio
    async def test_read_file_within_limit(self, tmp_path: Path):
        """Reading a file under 1MB returns content and size."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "read-app"
        project_dir.mkdir()
        (project_dir / "hello.txt").write_text("hello world")

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                create_resp = await ac.post(
                    "/api/projects", json={"name": "Read App", "path": str(project_dir)}
                )
                pid = create_resp.json()["id"]
                resp = await ac.get(f"/api/projects/{pid}/file", params={"path": "hello.txt"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "hello world"
        assert data["size"] == len("hello world")

    @pytest.mark.anyio
    async def test_read_file_too_large(self, tmp_path: Path):
        """Reading a file > 1MB returns 400 file_too_large."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "large-app"
        project_dir.mkdir()
        large_file = project_dir / "big.bin"
        large_file.write_bytes(b"x" * (1024 * 1024 + 1))

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                create_resp = await ac.post(
                    "/api/projects", json={"name": "Large App", "path": str(project_dir)}
                )
                pid = create_resp.json()["id"]
                resp = await ac.get(f"/api/projects/{pid}/file", params={"path": "big.bin"})
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "file_too_large"


class TestWriteFile:
    @pytest.mark.anyio
    async def test_write_file_success(self, tmp_path: Path):
        """PUT /api/projects/{id}/file writes the file and returns ok."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "write-app"
        project_dir.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                create_resp = await ac.post(
                    "/api/projects", json={"name": "Write App", "path": str(project_dir)}
                )
                pid = create_resp.json()["id"]
                resp = await ac.put(
                    f"/api/projects/{pid}/file",
                    json={"path": "CLAUDE.md", "content": "# Hello"},
                )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        assert (project_dir / "CLAUDE.md").read_text() == "# Hello"

    @pytest.mark.anyio
    async def test_write_file_path_traversal_returns_400(self, tmp_path: Path):
        """PUT with path that escapes project root returns 400 path_outside_project."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        project_dir = tmp_path / "safe-write"
        project_dir.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                create_resp = await ac.post(
                    "/api/projects", json={"name": "Safe Write", "path": str(project_dir)}
                )
                pid = create_resp.json()["id"]
                resp = await ac.put(
                    f"/api/projects/{pid}/file",
                    json={"path": "../../etc/passwd", "content": "evil"},
                )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "path_outside_project"


class TestBrowseDirectory:
    @pytest.mark.anyio
    async def test_browse_returns_entries(self, tmp_path: Path):
        """GET /api/system/browse returns directory entries."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        browse_dir = tmp_path / "browse-root"
        browse_dir.mkdir()
        (browse_dir / "subdir1").mkdir()
        (browse_dir / "subdir2").mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/system/browse", params={"path": str(browse_dir)})
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_path"] == str(browse_dir)
        names = [e["name"] for e in data["entries"]]
        assert "subdir1" in names
        assert "subdir2" in names

    @pytest.mark.anyio
    async def test_browse_nonexistent_returns_400(self, tmp_path: Path):
        """Browsing a missing path returns 400."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/system/browse", params={"path": str(tmp_path / "nope")})
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "path_not_found"

    @pytest.mark.anyio
    async def test_browse_file_returns_400(self, tmp_path: Path):
        """Browsing a file (not dir) returns 400 not_a_directory."""
        pf = tmp_path / "projects.json"
        pd = tmp_path / "factory-projects"
        pd.mkdir()
        f = tmp_path / "afile.txt"
        f.write_text("hi")

        with (
            patch("backend.services.project_service.PROJECTS_FILE", pf),
            patch("backend.services.project_service.PROJECTS_DIR", pd),
        ):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                resp = await ac.get("/api/system/browse", params={"path": str(f)})
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "not_a_directory"
