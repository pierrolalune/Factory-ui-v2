"""Tests for run_output_service — save/get/delete PTY output."""

import gzip
from pathlib import Path
from unittest.mock import patch

from backend.services import run_output_service


class TestSaveOutput:
    def test_creates_gzip_file(self, tmp_path: Path):
        """save_output writes a gzip file to the project run directory."""
        with patch.object(run_output_service, "PROJECTS_DIR", tmp_path):
            run_output_service.save_output("run1", "proj1", b"hello world")

        output = tmp_path / "proj1" / "runs" / "run1.output.gz"
        assert output.exists()
        assert gzip.decompress(output.read_bytes()) == b"hello world"

    def test_appends_to_existing(self, tmp_path: Path):
        """save_output appends new data to existing output."""
        with patch.object(run_output_service, "PROJECTS_DIR", tmp_path):
            run_output_service.save_output("run2", "proj1", b"line1\n")
            run_output_service.save_output("run2", "proj1", b"line2\n")

        path = tmp_path / "proj1" / "runs" / "run2.output.gz"
        assert gzip.decompress(path.read_bytes()) == b"line1\nline2\n"

    def test_caps_at_2mb(self, tmp_path: Path):
        """save_output caps total output at MAX_OUTPUT_BYTES."""
        large = b"x" * (run_output_service.MAX_OUTPUT_BYTES + 100)
        with patch.object(run_output_service, "PROJECTS_DIR", tmp_path):
            run_output_service.save_output("run3", "proj1", large)

        path = tmp_path / "proj1" / "runs" / "run3.output.gz"
        stored = gzip.decompress(path.read_bytes())
        assert len(stored) == run_output_service.MAX_OUTPUT_BYTES


class TestGetOutput:
    def test_returns_empty_string_when_no_file(self, tmp_path: Path):
        """get_output returns empty string when no output file exists."""
        with patch.object(run_output_service, "PROJECTS_DIR", tmp_path):
            result = run_output_service.get_output("missing", "proj1")
        assert result == ""

    def test_returns_base64_encoded_content(self, tmp_path: Path):
        """get_output returns base64-encoded raw bytes."""
        import base64

        run_dir = tmp_path / "proj1" / "runs"
        run_dir.mkdir(parents=True)
        (run_dir / "run4.output.gz").write_bytes(gzip.compress(b"terminal output"))

        with patch.object(run_output_service, "PROJECTS_DIR", tmp_path):
            result = run_output_service.get_output("run4", "proj1")

        assert base64.b64decode(result) == b"terminal output"


class TestDeleteOutput:
    def test_deletes_file(self, tmp_path: Path):
        """delete_output removes the gzip file."""
        run_dir = tmp_path / "proj1" / "runs"
        run_dir.mkdir(parents=True)
        path = run_dir / "run5.output.gz"
        path.write_bytes(gzip.compress(b"data"))

        with patch.object(run_output_service, "PROJECTS_DIR", tmp_path):
            run_output_service.delete_output("run5", "proj1")

        assert not path.exists()

    def test_noop_when_no_file(self, tmp_path: Path):
        """delete_output does not raise when file is missing."""
        with patch.object(run_output_service, "PROJECTS_DIR", tmp_path):
            run_output_service.delete_output("no-such-run", "proj1")  # should not raise
