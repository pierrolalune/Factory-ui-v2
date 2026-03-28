"""GitHub integration service — push branches and manage pull requests via GitHub API."""

import logging
import re
import subprocess

import httpx

from backend.services.settings_service import _load as _load_settings

logger = logging.getLogger("factory")

_GITHUB_API = "https://api.github.com"
_GITHUB_RE = re.compile(r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>.+?)(?:\.git)?$")


def get_remote_info(project_path: str) -> dict:
    """Parse the git remote origin URL and fetch the default branch from GitHub API.

    Returns a dict with keys: owner, repo, default_branch, html_url.
    Raises ValueError with a code on failure.
    """
    remote_url = _get_origin_url(project_path)
    if not remote_url:
        raise ValueError("no_remote")

    match = _GITHUB_RE.search(remote_url)
    if not match:
        raise ValueError("not_github")

    owner = match.group("owner")
    repo = match.group("repo")
    html_url = f"https://github.com/{owner}/{repo}"

    settings = _load_settings()
    if not settings.github_token:
        raise ValueError("no_token")

    default_branch = _fetch_default_branch(owner, repo, settings.github_token)
    return {
        "owner": owner,
        "repo": repo,
        "default_branch": default_branch,
        "html_url": html_url,
    }


def push_branch(project_path: str, branch: str, worktree_path: str | None, force: bool = False) -> dict:
    """Run git push origin {branch} in the worktree or project directory.

    Returns {"ok": True, "remote_url": str} or raises ValueError with code on failure.
    """
    work_dir = worktree_path or project_path
    cmd = ["git", "push", "origin", branch]
    if force:
        cmd.append("--force")

    result = subprocess.run(
        cmd,
        cwd=work_dir,
        capture_output=True,
        text=True,
        timeout=60,
    )

    if result.returncode != 0:
        stderr = result.stderr.lower()
        if "rejected" in stderr or "non-fast-forward" in stderr:
            raise ValueError("push_rejected")
        if "no such remote" in stderr or "does not appear" in stderr:
            raise ValueError("no_remote")
        raise ValueError(f"push_failed: {result.stderr.strip()}")

    remote_info = get_remote_info(project_path)
    remote_url = f"{remote_info['html_url']}/tree/{branch}"
    return {"ok": True, "remote_url": remote_url}


def create_pull_request(project_path: str, head_branch: str, base_branch: str, title: str, body: str) -> dict:
    """Create a GitHub pull request via the REST API.

    Returns a PullRequest dict or raises ValueError with a code.
    """
    settings = _load_settings()
    if not settings.github_token:
        raise ValueError("no_token")

    remote_info = get_remote_info(project_path)
    owner = remote_info["owner"]
    repo = remote_info["repo"]

    payload = {
        "title": title,
        "body": body,
        "head": head_branch,
        "base": base_branch,
    }
    headers = _github_headers(settings.github_token)

    with httpx.Client(timeout=30) as client:
        resp = client.post(f"{_GITHUB_API}/repos/{owner}/{repo}/pulls", json=payload, headers=headers)

    if resp.status_code == 422:
        # PR might already exist
        existing = list_pull_requests(project_path, branch=head_branch)
        if existing:
            return existing[0]
        raise ValueError("branch_not_pushed")

    if resp.status_code == 409 or (resp.status_code == 422 and "already exists" in resp.text):
        existing = list_pull_requests(project_path, branch=head_branch)
        if existing:
            return existing[0]

    _raise_for_github_error(resp)
    return _parse_pr(resp.json())


def list_pull_requests(project_path: str, branch: str | None = None) -> list[dict]:
    """List open pull requests for the project. Optionally filter by head branch."""
    settings = _load_settings()
    if not settings.github_token:
        return []

    try:
        remote_info = get_remote_info(project_path)
    except ValueError:
        return []

    owner = remote_info["owner"]
    repo = remote_info["repo"]
    headers = _github_headers(settings.github_token)

    params: dict = {"state": "open", "per_page": 50}
    if branch:
        params["head"] = f"{owner}:{branch}"

    with httpx.Client(timeout=30) as client:
        resp = client.get(f"{_GITHUB_API}/repos/{owner}/{repo}/pulls", params=params, headers=headers)

    if resp.status_code != 200:
        logger.warning("GitHub list PRs failed: %s", resp.text)
        return []

    return [_parse_pr(pr) for pr in resp.json()]


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _get_origin_url(project_path: str) -> str:
    """Return the URL of the 'origin' remote for the given path."""
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            cwd=project_path,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


def _fetch_default_branch(owner: str, repo: str, token: str) -> str:
    """Return the default branch name from GitHub API, falling back to 'main'."""
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"{_GITHUB_API}/repos/{owner}/{repo}",
                headers=_github_headers(token),
            )
        if resp.status_code == 200:
            return resp.json().get("default_branch", "main")
    except Exception:
        pass
    return "main"


def _github_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _parse_pr(pr: dict) -> dict:
    """Extract the fields we expose from a GitHub PR response dict."""
    return {
        "number": pr.get("number"),
        "title": pr.get("title", ""),
        "url": pr.get("html_url", ""),
        "state": pr.get("state", "open"),
        "head_branch": pr.get("head", {}).get("ref", ""),
        "base_branch": pr.get("base", {}).get("ref", ""),
        "created_at": pr.get("created_at", ""),
    }


def _raise_for_github_error(resp: httpx.Response) -> None:
    """Raise ValueError with a code if the response is not a 2xx success."""
    if resp.is_success:
        return
    if resp.status_code == 401:
        raise ValueError("no_token")
    raise ValueError(f"github_api_error_{resp.status_code}")
