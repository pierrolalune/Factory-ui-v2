"""Tests for Sprint 3 — Run Execution Engine (RED phase, TDD).

Coverage:
  - GET /api/projects/{id}/commands — command discovery
  - CommandInfo frontmatter parsing
  - PromptDetector pattern matching
  - StreamJsonParser ANSI stripping + JSON parsing
  - POST /api/run/command — launch + validation
  - POST /api/run/{id}/cancel — cancel + 404
"""

import json
import textwrap
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_project(tmp_path: Path, name: str = "test-proj") -> dict:
    """Return a minimal project dict stored on disk."""
    project_id = f"{name}-aabbcc"
    project = {
        "id": project_id,
        "name": name,
        "path": str(tmp_path),
        "description": "",
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    return project


def _install_command(project_path: Path, stem: str, content: str) -> None:
    """Write a .md command file into project/.claude/commands/."""
    cmd_dir = project_path / ".claude" / "commands"
    cmd_dir.mkdir(parents=True, exist_ok=True)
    (cmd_dir / f"{stem}.md").write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# GET /api/projects/{id}/commands
# ---------------------------------------------------------------------------


class TestGetProjectCommands:
    @pytest.mark.anyio
    async def test_returns_empty_list_when_no_claude_dir(
        self, client: AsyncClient, tmp_path: Path
    ):
        """Returns [] when project/.claude/ doesn't exist."""
        project = _make_project(tmp_path)
        with (
            patch("backend.routers.run.project_service.get_project") as mock_get,
            patch("backend.services.claude_folder_scanner.scan_commands") as mock_scan,
        ):
            from backend.schemas.project import ProjectSummary

            mock_get.return_value = ProjectSummary(**project)
            mock_scan.return_value = []
            resp = await client.get(f"/api/projects/{project['id']}/commands")
        assert resp.status_code == 200
        assert resp.json() == []

    @pytest.mark.anyio
    async def test_returns_commands_from_claude_dir(
        self, client: AsyncClient, tmp_path: Path
    ):
        """Returns discovered commands when .claude/commands/ has .md files."""
        _install_command(
            tmp_path,
            "polisher",
            "---\nname: Polisher\ndescription: Code quality\n---\nRun /polisher $ARGUMENTS",
        )
        project = _make_project(tmp_path)
        with patch("backend.routers.run.project_service.get_project") as mock_get:
            from backend.schemas.project import ProjectSummary

            mock_get.return_value = ProjectSummary(**project)
            resp = await client.get(f"/api/projects/{project['id']}/commands")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["stem"] == "polisher"
        assert data[0]["has_arguments"] is True

    @pytest.mark.anyio
    async def test_returns_404_for_unknown_project(self, client: AsyncClient):
        """Returns 404 when project_id doesn't match any project."""
        with patch("backend.routers.run.project_service.get_project") as mock_get:
            mock_get.return_value = None
            resp = await client.get("/api/projects/nonexistent-id/commands")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# CommandInfo frontmatter parsing (unit tests for claude_folder_scanner)
# ---------------------------------------------------------------------------


class TestClaudeFolderScanner:
    def test_parses_frontmatter_name_and_description(self, tmp_path: Path):
        """Parses YAML frontmatter for name and description."""
        from backend.services.claude_folder_scanner import scan_commands

        _install_command(
            tmp_path,
            "feature-spec",
            textwrap.dedent("""\
                ---
                name: Feature Spec
                description: Turn idea into spec
                ---
                Use $ARGUMENTS to specify the feature.
            """),
        )
        results = scan_commands(str(tmp_path))
        assert len(results) == 1
        cmd = results[0]
        assert cmd.stem == "feature-spec"
        assert cmd.name == "Feature Spec"
        assert cmd.description == "Turn idea into spec"
        assert cmd.has_arguments is True

    def test_has_arguments_false_when_no_placeholder(self, tmp_path: Path):
        """has_arguments is False when $ARGUMENTS is not in file content."""
        from backend.services.claude_folder_scanner import scan_commands

        _install_command(tmp_path, "retro", "---\nname: Retro\n---\nRun retrospective.\n")
        results = scan_commands(str(tmp_path))
        assert results[0].has_arguments is False

    def test_returns_empty_list_when_no_claude_dir(self, tmp_path: Path):
        """Returns [] when project/.claude/ directory doesn't exist."""
        from backend.services.claude_folder_scanner import scan_commands

        results = scan_commands(str(tmp_path))
        assert results == []

    def test_stem_is_filename_without_extension(self, tmp_path: Path):
        """Stem is derived from filename, not from frontmatter."""
        from backend.services.claude_folder_scanner import scan_commands

        _install_command(tmp_path, "my-cmd", "---\nname: Override Name\n---\nContent.\n")
        results = scan_commands(str(tmp_path))
        assert results[0].stem == "my-cmd"

    def test_name_falls_back_to_stem_when_no_frontmatter(self, tmp_path: Path):
        """Name equals stem when no YAML frontmatter is present."""
        from backend.services.claude_folder_scanner import scan_commands

        _install_command(tmp_path, "quick", "Just some content.\n")
        results = scan_commands(str(tmp_path))
        assert results[0].name == "quick"


# ---------------------------------------------------------------------------
# PromptDetector
# ---------------------------------------------------------------------------


class TestPromptDetector:
    def test_detects_yn_pattern(self):
        """Returns 'awaiting_input' when [y/n] pattern is found."""
        from backend.services.prompt_detector import PromptDetector

        detector = PromptDetector()
        result = detector.feed("Allow this action? [y/n] ")
        assert result == "awaiting_input"

    def test_detects_Yn_pattern(self):
        """Returns 'awaiting_input' when [Y/n] variant is found."""
        from backend.services.prompt_detector import PromptDetector

        detector = PromptDetector()
        result = detector.feed("Continue? [Y/n] ")
        assert result == "awaiting_input"

    def test_detects_do_you_want_to_allow(self):
        """Returns 'awaiting_input' for 'Do you want to allow' text."""
        from backend.services.prompt_detector import PromptDetector

        detector = PromptDetector()
        result = detector.feed("Do you want to allow this operation?")
        assert result == "awaiting_input"

    def test_detects_allow_this_action(self):
        """Returns 'awaiting_input' for 'Allow this action' text."""
        from backend.services.prompt_detector import PromptDetector

        detector = PromptDetector()
        result = detector.feed("Allow this action and proceed?")
        assert result == "awaiting_input"

    def test_returns_none_on_normal_output(self):
        """Returns None when no prompt pattern is detected."""
        from backend.services.prompt_detector import PromptDetector

        detector = PromptDetector()
        result = detector.feed("Writing file src/auth.ts...")
        assert result is None

    def test_returns_active_when_output_resumes_after_awaiting(self):
        """Returns 'active' when output resumes after awaiting_input state."""
        from backend.services.prompt_detector import PromptDetector

        detector = PromptDetector()
        detector.feed("Allow this action? [y/n] ")  # transition to awaiting
        result = detector.feed("Reading file...")  # output resumes
        assert result == "active"

    def test_returns_none_on_repeat_normal_output(self):
        """Returns None on subsequent normal output (no double-fire)."""
        from backend.services.prompt_detector import PromptDetector

        detector = PromptDetector()
        detector.feed("Reading file...")  # normal, no transition
        result = detector.feed("Writing file...")  # still normal
        assert result is None


# ---------------------------------------------------------------------------
# StreamJsonParser
# ---------------------------------------------------------------------------


class TestStreamJsonParser:
    def test_strips_ansi_escape_codes(self):
        """Strips ANSI CSI sequences before parsing."""
        from backend.services.stream_json_parser import StreamJsonParser

        parser = StreamJsonParser()
        ansi_line = '\x1b[32m{"type": "system"}\x1b[0m\n'
        events = parser.feed(ansi_line)
        assert len(events) == 1
        assert events[0]["type"] == "system"

    def test_parses_valid_json_line(self):
        """Parses a plain JSON line and returns it as a dict."""
        from backend.services.stream_json_parser import StreamJsonParser

        parser = StreamJsonParser()
        events = parser.feed('{"type": "result", "cost_usd": 0.05}\n')
        assert len(events) == 1
        assert events[0]["type"] == "result"
        assert events[0]["cost_usd"] == 0.05

    def test_skips_non_json_lines(self):
        """Non-JSON lines are ignored gracefully."""
        from backend.services.stream_json_parser import StreamJsonParser

        parser = StreamJsonParser()
        events = parser.feed("not json at all\n")
        assert events == []

    def test_parses_multiple_lines(self):
        """Multiple JSON lines in one feed call are all parsed."""
        from backend.services.stream_json_parser import StreamJsonParser

        parser = StreamJsonParser()
        text = '{"type": "a"}\n{"type": "b"}\n'
        events = parser.feed(text)
        assert len(events) == 2
        assert events[0]["type"] == "a"
        assert events[1]["type"] == "b"

    def test_handles_wrapped_json_line(self):
        """Reassembles ConPTY-wrapped JSON split across 120-char lines."""
        from backend.services.stream_json_parser import StreamJsonParser

        parser = StreamJsonParser()
        # Simulate a JSON line that was wrapped at column 120 with CR+LF
        long_json = json.dumps({"type": "assistant", "data": "x" * 200})
        # Split at column 120 with CR+LF (ConPTY wrapping)
        part1 = long_json[:120] + "\r\n"
        part2 = long_json[120:] + "\n"
        events1 = parser.feed(part1)
        events2 = parser.feed(part2)
        all_events = events1 + events2
        assert len(all_events) == 1
        assert all_events[0]["type"] == "assistant"


# ---------------------------------------------------------------------------
# POST /api/run/command
# ---------------------------------------------------------------------------


class TestPostRunCommand:
    @pytest.mark.anyio
    async def test_returns_400_when_command_not_found(
        self, client: AsyncClient, tmp_path: Path
    ):
        """Returns 400 command_not_found when stem doesn't exist in project/.claude/."""
        project = _make_project(tmp_path)
        with patch("backend.routers.run.project_service.get_project") as mock_get:
            from backend.schemas.project import ProjectSummary

            mock_get.return_value = ProjectSummary(**project)
            resp = await client.post(
                "/api/run/command",
                json={
                    "project_id": project["id"],
                    "stem": "nonexistent-cmd",
                    "args": "",
                },
            )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "command_not_found"

    @pytest.mark.anyio
    async def test_creates_run_with_correct_fields(
        self, client: AsyncClient, tmp_path: Path
    ):
        """POST /api/run/command creates a run and returns run_id."""
        _install_command(
            tmp_path,
            "polisher",
            "---\nname: Polisher\ndescription: Quality\n---\nRun $ARGUMENTS\n",
        )
        project = _make_project(tmp_path)
        with (
            patch("backend.routers.run.project_service.get_project") as mock_get,
            patch("backend.routers.run.process_manager.register_run") as mock_register,
            patch("backend.routers.run.process_manager.spawn_command_run") as mock_spawn,
            patch("backend.routers.run.process_manager.count_active_runs_for_worktree") as mock_count,
        ):
            from backend.schemas.project import ProjectSummary

            mock_get.return_value = ProjectSummary(**project)
            mock_register.return_value = "cmd-polisher-aabbccdd"
            mock_count.return_value = 0
            resp = await client.post(
                "/api/run/command",
                json={
                    "project_id": project["id"],
                    "stem": "polisher",
                    "args": "src/components/",
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "run_id" in data
        assert data["run_id"].startswith("cmd-polisher-")
        mock_spawn.assert_called_once()

    @pytest.mark.anyio
    async def test_returns_404_for_unknown_project(self, client: AsyncClient):
        """Returns 404 when project_id doesn't match any project."""
        with patch("backend.routers.run.project_service.get_project") as mock_get:
            mock_get.return_value = None
            resp = await client.post(
                "/api/run/command",
                json={"project_id": "ghost-proj", "stem": "anything", "args": ""},
            )
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_includes_warning_when_concurrent_runs_high(
        self, client: AsyncClient, tmp_path: Path
    ):
        """Response includes warning when 3+ runs are active on the same worktree."""
        _install_command(tmp_path, "polisher", "Run $ARGUMENTS\n")
        project = _make_project(tmp_path)
        with (
            patch("backend.routers.run.project_service.get_project") as mock_get,
            patch("backend.routers.run.process_manager.register_run") as mock_register,
            patch("backend.routers.run.process_manager.spawn_command_run"),
            patch("backend.routers.run.process_manager.count_active_runs_for_worktree") as mock_count,
        ):
            from backend.schemas.project import ProjectSummary

            mock_get.return_value = ProjectSummary(**project)
            mock_register.return_value = "cmd-polisher-aabbccdd"
            mock_count.return_value = 3  # 3 already active → warning
            resp = await client.post(
                "/api/run/command",
                json={"project_id": project["id"], "stem": "polisher", "args": ""},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("warning") == "concurrent_runs_high"


# ---------------------------------------------------------------------------
# POST /api/run/{run_id}/cancel
# ---------------------------------------------------------------------------


class TestCancelRun:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_run(self, client: AsyncClient):
        """Returns 404 when run_id is not found."""
        with patch("backend.routers.run.process_manager.cancel_run") as mock_cancel:
            mock_cancel.return_value = False
            resp = await client.post("/api/run/unknown-run-id/cancel")
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_cancel_active_run_returns_ok(self, client: AsyncClient):
        """Returns {ok: true} when run is successfully cancelled."""
        with patch("backend.routers.run.process_manager.cancel_run") as mock_cancel:
            mock_cancel.return_value = True
            resp = await client.post("/api/run/cmd-polisher-aabbccdd/cancel")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


# ---------------------------------------------------------------------------
# GET /api/run/{run_id}
# ---------------------------------------------------------------------------


class TestGetRun:
    @pytest.mark.anyio
    async def test_returns_404_for_unknown_run(self, client: AsyncClient):
        """Returns 404 when run_id is not in memory or on disk."""
        with patch("backend.routers.run.process_manager.get_run") as mock_get:
            mock_get.return_value = None
            resp = await client.get("/api/run/ghost-run-id")
        assert resp.status_code == 404

    @pytest.mark.anyio
    async def test_returns_run_state(self, client: AsyncClient):
        """Returns full run dict when run exists."""
        fake_run = {
            "run_id": "cmd-polisher-aabbccdd",
            "type": "command",
            "status": "active",
            "project_id": "proj-001",
            "project_name": "My Project",
            "project_path": "/tmp/proj",
            "prompt": "/polisher src/",
            "skip_permissions": False,
            "awaiting_input": False,
        }
        with patch("backend.routers.run.process_manager.get_run") as mock_get:
            mock_get.return_value = fake_run
            resp = await client.get("/api/run/cmd-polisher-aabbccdd")
        assert resp.status_code == 200
        data = resp.json()
        assert data["run_id"] == "cmd-polisher-aabbccdd"
        assert data["status"] == "active"
