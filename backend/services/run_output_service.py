"""Run output service — save and retrieve gzipped PTY output per run.

Output files are stored at:
  ~/.factory-projects/{project_id}/runs/{run_id}.output.gz

Capped at 2 MB uncompressed. The ring buffer behaviour (truncation) is applied
on write: if total data would exceed the cap, the oldest bytes are dropped.
"""

import base64
import gzip
import logging
from pathlib import Path

logger = logging.getLogger("factory")

PROJECTS_DIR = Path.home() / ".factory-projects"
MAX_OUTPUT_BYTES = 2 * 1024 * 1024  # 2 MB uncompressed


def _output_path(run_id: str, project_id: str) -> Path:
    return PROJECTS_DIR / project_id / "runs" / f"{run_id}.output.gz"


def save_output(run_id: str, project_id: str, data: bytes) -> None:
    """Append PTY bytes to the run's output file, capping at MAX_OUTPUT_BYTES.

    Existing data is read, merged with new data, then the tail (most recent
    bytes) up to the cap is written back as a gzip file.
    """
    path = _output_path(run_id, project_id)
    path.parent.mkdir(parents=True, exist_ok=True)

    existing = _read_raw(path)
    combined = existing + data
    # Keep only the last MAX_OUTPUT_BYTES to act as a ring buffer
    if len(combined) > MAX_OUTPUT_BYTES:
        combined = combined[-MAX_OUTPUT_BYTES:]

    try:
        path.write_bytes(gzip.compress(combined))
    except OSError as exc:
        logger.warning("Failed to write output for run %s: %s", run_id, exc)


def get_output(run_id: str, project_id: str) -> str:
    """Return the stored PTY output as a base64-encoded string (raw bytes).

    Returns an empty string if no output file exists.
    """
    path = _output_path(run_id, project_id)
    raw = _read_raw(path)
    return base64.b64encode(raw).decode()


def delete_output(run_id: str, project_id: str) -> None:
    """Remove the output file for a run if it exists."""
    path = _output_path(run_id, project_id)
    try:
        if path.exists():
            path.unlink()
    except OSError as exc:
        logger.warning("Failed to delete output for run %s: %s", run_id, exc)


def _read_raw(path: Path) -> bytes:
    """Decompress and return existing output bytes, or empty bytes on missing/corrupt file."""
    if not path.exists():
        return b""
    try:
        return gzip.decompress(path.read_bytes())
    except Exception as exc:
        logger.warning("Failed to read output %s: %s", path, exc)
        return b""
