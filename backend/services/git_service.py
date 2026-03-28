"""Git service — subprocess wrappers for git status, diff, stage, commit, log."""

import logging
import subprocess
from pathlib import Path

from backend.schemas.worktree import (
    DiffHunk,
    DiffLine,
    GitCommit,
    GitDiff,
    GitFileChange,
    GitStatus,
)

logger = logging.getLogger("factory")

# Binary file extensions — skip diff for these
_BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".pdf", ".zip", ".gz", ".tar", ".mp4", ".mp3", ".wav",
}


def _resolve_cwd(project_path: str, worktree_path: str | None) -> Path:
    """Return the working directory for git commands."""
    if worktree_path:
        return Path(worktree_path)
    return Path(project_path)


def _run(args: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True)


def _parse_porcelain_line(line: str) -> GitFileChange | None:
    """Parse a single `git status --porcelain` line into a GitFileChange."""
    if len(line) < 4:
        return None
    xy = line[:2]
    path_part = line[3:]

    # Detect rename: "R  old -> new" or "old -> new"
    if " -> " in path_part:
        old_path, new_path = path_part.split(" -> ", 1)
        return GitFileChange(path=new_path, change_type="renamed", old_path=old_path)

    index_status = xy[0]  # staged
    work_status = xy[1]   # unstaged

    # Determine change type from combined status chars
    all_chars = index_status + work_status
    if "D" in all_chars:
        change_type = "deleted"
    elif "A" in all_chars or "?" in all_chars:
        change_type = "added"
    elif "R" in all_chars:
        change_type = "renamed"
    else:
        change_type = "modified"

    return GitFileChange(path=path_part, change_type=change_type)


def get_status(project_path: str, worktree_path: str | None = None) -> GitStatus:
    """Return the current git status for the project or worktree."""
    cwd = _resolve_cwd(project_path, worktree_path)

    result = _run(["git", "status", "--porcelain", "-b"], cwd)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git status failed")

    lines = result.stdout.splitlines()
    branch = "unknown"
    staged: list[GitFileChange] = []
    unstaged: list[GitFileChange] = []
    untracked: list[str] = []

    for line in lines:
        if line.startswith("## "):
            # ## main...origin/main [ahead 2, behind 1]
            branch_part = line[3:].split("...")[0]
            branch = branch_part.strip()
            continue

        if len(line) < 2:
            continue

        x = line[0]  # staged status
        y = line[1]  # worktree status

        if x == "?" and y == "?":
            untracked.append(line[3:])
            continue

        path_part = line[3:]
        if " -> " in path_part:
            old_p, new_p = path_part.split(" -> ", 1)
        else:
            old_p, new_p = None, path_part

        # Staged
        if x not in (" ", "?"):
            ct = _status_char_to_type(x)
            staged.append(GitFileChange(path=new_p, change_type=ct, old_path=old_p if old_p else None))

        # Unstaged
        if y not in (" ", "?"):
            ct = _status_char_to_type(y)
            unstaged.append(GitFileChange(path=new_p, change_type=ct))

    # ahead/behind
    ahead, behind = _get_ahead_behind(cwd)

    return GitStatus(
        branch=branch,
        is_dirty=bool(staged or unstaged or untracked),
        staged=staged,
        unstaged=unstaged,
        untracked=untracked,
        ahead=ahead,
        behind=behind,
    )


def _status_char_to_type(ch: str) -> str:
    mapping = {"M": "modified", "A": "added", "D": "deleted", "R": "renamed"}
    return mapping.get(ch, "modified")


def _get_ahead_behind(cwd: Path) -> tuple[int, int]:
    """Return (ahead, behind) relative to upstream. Returns (0, 0) if no upstream."""
    result = _run(["git", "rev-list", "--left-right", "--count", "HEAD...@{u}"], cwd)
    if result.returncode != 0:
        return 0, 0
    parts = result.stdout.strip().split()
    if len(parts) == 2:
        return int(parts[0]), int(parts[1])
    return 0, 0


def _is_binary_path(file_path: str) -> bool:
    suffix = Path(file_path).suffix.lower()
    return suffix in _BINARY_EXTENSIONS


def _check_binary_content(cwd: Path, file_path: str, staged: bool) -> bool:
    """Check if file content has null bytes (binary detection)."""
    if staged:
        result = _run(["git", "show", f":{file_path}"], cwd)
        content = result.stdout
    else:
        try:
            full = cwd / file_path
            content = full.read_bytes()[:8192].decode("latin-1")
        except Exception:
            return False
    return "\x00" in content


def get_diff(
    project_path: str,
    file_path: str,
    staged: bool = False,
    worktree_path: str | None = None,
) -> GitDiff:
    """Return parsed diff for a single file."""
    cwd = _resolve_cwd(project_path, worktree_path)

    if _is_binary_path(file_path):
        return GitDiff(file_path=file_path, is_staged=staged, is_binary=True)

    args = ["git", "diff"]
    if staged:
        args.append("--cached")
    args += ["--", file_path]

    result = _run(args, cwd)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git diff failed")

    if "\x00" in result.stdout:
        return GitDiff(file_path=file_path, is_staged=staged, is_binary=True)

    hunks = _parse_unified_diff(result.stdout)
    return GitDiff(file_path=file_path, is_staged=staged, is_binary=False, hunks=hunks)


def _parse_unified_diff(diff_text: str) -> list[DiffHunk]:
    """Parse unified diff output into DiffHunk/DiffLine objects."""
    hunks: list[DiffHunk] = []
    current_hunk: DiffHunk | None = None
    old_line = 0
    new_line = 0

    for line in diff_text.splitlines():
        if line.startswith("@@"):
            # Parse @@ -old_start,count +new_start,count @@ context
            parts = line.split(" ")
            old_info = parts[1].lstrip("-")
            new_info = parts[2].lstrip("+")
            old_line = int(old_info.split(",")[0])
            new_line = int(new_info.split(",")[0])
            current_hunk = DiffHunk(header=line, lines=[])
            hunks.append(current_hunk)
            continue

        if current_hunk is None:
            continue

        if line.startswith("+") and not line.startswith("+++"):
            current_hunk.lines.append(DiffLine(type="add", content=line[1:], new_line_no=new_line))
            new_line += 1
        elif line.startswith("-") and not line.startswith("---"):
            current_hunk.lines.append(DiffLine(type="remove", content=line[1:], old_line_no=old_line))
            old_line += 1
        elif line.startswith(" "):
            current_hunk.lines.append(
                DiffLine(type="context", content=line[1:], old_line_no=old_line, new_line_no=new_line)
            )
            old_line += 1
            new_line += 1

    return hunks


def stage_files(
    project_path: str, paths: list[str], worktree_path: str | None = None
) -> None:
    """Stage the given file paths."""
    cwd = _resolve_cwd(project_path, worktree_path)
    result = _run(["git", "add", "--"] + paths, cwd)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git add failed")


def unstage_files(
    project_path: str, paths: list[str], worktree_path: str | None = None
) -> None:
    """Unstage the given file paths."""
    cwd = _resolve_cwd(project_path, worktree_path)
    result = _run(["git", "reset", "HEAD", "--"] + paths, cwd)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git reset failed")


def discard_files(
    project_path: str, paths: list[str], worktree_path: str | None = None
) -> None:
    """Discard unstaged changes (checkout -- <paths>). Destructive."""
    cwd = _resolve_cwd(project_path, worktree_path)
    result = _run(["git", "checkout", "--"] + paths, cwd)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git checkout failed")


def commit(
    project_path: str, message: str, worktree_path: str | None = None
) -> dict:
    """Create a commit from staged changes. Returns {hash, message}."""
    cwd = _resolve_cwd(project_path, worktree_path)
    result = _run(["git", "commit", "-m", message], cwd)
    if result.returncode != 0:
        stderr = result.stderr.strip()
        if "nothing to commit" in stderr or "nothing added to commit" in result.stdout:
            raise ValueError("nothing_staged")
        raise RuntimeError(stderr or "git commit failed")

    # Extract short hash from output "  main abc1234  message"
    short_hash = ""
    for line in result.stdout.splitlines():
        line = line.strip()
        if line and not line.startswith("["):
            continue
        # "[main abc1234] message"
        if line.startswith("["):
            parts = line.lstrip("[").split("]")[0].split()
            if len(parts) >= 2:
                short_hash = parts[-1][:7]
            break

    return {"hash": short_hash, "message": message.split("\n")[0]}


def get_log(
    project_path: str, limit: int = 10, worktree_path: str | None = None
) -> list[GitCommit]:
    """Return the last N commits."""
    cwd = _resolve_cwd(project_path, worktree_path)
    fmt = "%H%x1f%s%x1f%an%x1f%aI"
    result = _run(["git", "log", f"-{limit}", f"--format={fmt}"], cwd)
    if result.returncode != 0:
        return []

    commits: list[GitCommit] = []
    for line in result.stdout.strip().splitlines():
        if not line.strip():
            continue
        parts = line.split("\x1f")
        if len(parts) < 4:
            continue
        commits.append(
            GitCommit(
                hash=parts[0][:7],
                message=parts[1],
                author=parts[2],
                date=parts[3],
            )
        )
    return commits
