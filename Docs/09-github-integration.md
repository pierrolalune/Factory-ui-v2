# Spec 09 — GitHub Integration

**Domain**: GitHub
**Location**: Project settings + Worktree card actions + Git Panel
**Sprint**: 7

---

## Overview

GitHub integration lets the user push branches and create pull requests without leaving Factory UI. The primary workflow is:
1. Run an agent on a worktree branch
2. Review the changes in the Git panel
3. Commit the changes
4. Push the branch to GitHub
5. Open a PR directly from the worktree card

This is a single-user local tool — there is no OAuth flow or multi-account support. The user provides a GitHub personal access token (PAT) stored in settings.

---

## Tech Stack

- **Backend**: Python `httpx` for GitHub REST API calls. Local `git push` via subprocess.
- **Auth**: GitHub PAT stored in `~/.factory-cli.json` (global settings)
- **Frontend**: Next.js, TanStack Query

---

## Auth Model

No OAuth. The user provides a **GitHub Personal Access Token (PAT)** with `repo` scope.

Stored in: `~/.factory-cli.json` under `github_token`.

The token is validated once when entered (via `GET https://api.github.com/user`) and the GitHub username is cached.

---

## Data Model

### GitHubConfig (in global settings)

```typescript
interface GitHubConfig {
  token: string           // GitHub PAT (stored in ~/.factory-cli.json)
  username: string        // cached GitHub username
  token_valid: boolean    // last validation result
}
```

### RemoteInfo

```typescript
interface RemoteInfo {
  owner: string           // e.g. "pierre"
  repo: string            // e.g. "my-app"
  default_branch: string  // e.g. "main"
  html_url: string        // e.g. "https://github.com/pierre/my-app"
}
```

### PullRequest

```typescript
interface PullRequest {
  number: number
  title: string
  url: string             // GitHub PR URL
  state: "open" | "closed" | "merged"
  head_branch: string
  base_branch: string
  created_at: string
}
```

### PushResult

```typescript
interface PushResult {
  ok: boolean
  remote_url: string      // e.g. "https://github.com/pierre/my-app/tree/feat/login"
  error?: string
}
```

---

## API Endpoints

### `GET /api/settings/github`
Get the current GitHub config (token is masked).

**Response**:
```json
{
  "token_set": true,
  "token_masked": "ghp_****...****Ab3c",
  "username": "pierre",
  "token_valid": true
}
```

---

### `POST /api/settings/github/token`
Save or update the GitHub PAT.

**Request**: `{ "token": "ghp_xxxxxxxxxxxxxxxxxxxx" }`

**Behavior**:
1. Validates token against `GET https://api.github.com/user`
2. Caches username from the API response
3. Stores in `~/.factory-cli.json`

**Response**: `{ "username": "pierre", "valid": true }`

**Errors**:
- `400 invalid_token` — token rejected by GitHub API

---

### `DELETE /api/settings/github/token`
Remove the stored GitHub token.

**Response**: `{ "ok": true }`

---

### `GET /api/projects/{id}/github/remote`
Get the GitHub remote info for a project.

**Behavior**: Reads the project's `github_remote` URL and parses `owner/repo`. Fetches the default branch from the GitHub API.

**Response**: `RemoteInfo`

**Errors**:
- `400 no_remote_configured` — project has no `github_remote` set
- `400 not_github` — remote is not a GitHub URL
- `400 no_token` — no GitHub token configured

---

### `POST /api/projects/{id}/github/push`
Push a branch to GitHub.

**Request**:
```json
{
  "branch": "feat/login",
  "worktree_path": "/Users/pierre/code/my-app-worktrees/feat-login",
  "force": false
}
```

**Behavior**: Runs `git push origin {branch}` in the specified working directory.

**Response**: `PushResult`

**Errors**:
- `400 no_remote` — remote origin not configured
- `400 push_rejected` — push rejected by remote (diverged branch), with hint to use force

---

### `POST /api/projects/{id}/github/pull-request`
Create a GitHub pull request.

**Request**:
```json
{
  "head_branch": "feat/login",
  "base_branch": "main",
  "title": "feat: add login page with OAuth",
  "body": "## Summary\n\n- Added OAuth login with Google\n- Added session management\n\n🤖 Generated with Factory UI"
}
```

**Behavior**: Calls `POST https://api.github.com/repos/{owner}/{repo}/pulls`

**Response**: `PullRequest`

**Errors**:
- `400 no_token` — no GitHub token
- `400 branch_not_pushed` — head branch doesn't exist on GitHub yet (push first)
- `409 pr_already_exists` — a PR for this branch already exists, returns existing PR

---

### `GET /api/projects/{id}/github/pull-requests`
List open pull requests for the project.

**Query params**:
- `branch` (optional): filter to PRs for a specific branch

**Response**: `PullRequest[]`

---

## UI: GitHub in the Project IDE

GitHub actions are surfaced in two places:

### 1. Worktree Card — Push & PR Actions

After commit, the worktree card shows push/PR buttons:

```
┌──────────────────────────────────────────────────────┐
│  feat/login                                          │
│  Created from: main                                  │
│  ✓ 2 commits ahead · Clean                           │
│                                                      │
│              [Push to GitHub]  [Open PR]  [Delete ×] │
└──────────────────────────────────────────────────────┘
```

**[Push to GitHub]** button:
- Only shown if `ahead > 0` and project has `github_remote` set
- Calls `POST /api/projects/{id}/github/push`
- On success: shows "Pushed ✓" + link to branch on GitHub
- On push-rejected: shows "Push rejected — branch has diverged. [Force push?]"

**[Open PR]** button:
- Shown after push succeeds (or if branch is already on GitHub)
- If a PR already exists for this branch: shows "View PR #42 →" (link to GitHub)
- If no PR: opens the PR creation form (see below)

### 2. PR Creation Form

Slides in below the worktree card (inline, not a modal).

```
┌──────────────────────────────────────────────────────────┐
│  Open Pull Request                            [Cancel ×]  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Title *                                                  │
│  ┌─────────────────────────────────────────────────┐     │
│  │ feat: add login page with OAuth                  │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  Base branch                                              │
│  ┌─────────────────────────────────────────────────┐     │
│  │  main  ▾                                        │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  Description  (optional)                                  │
│  ┌─────────────────────────────────────────────────┐     │
│  │ ## Summary                                       │     │
│  │                                                  │     │
│  │ - Added OAuth login with Google                  │     │
│  │ - Added session management                       │     │
│  │                                                  │     │
│  │ 🤖 Generated with Factory UI                    │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│                                   [Open Pull Request]     │
└──────────────────────────────────────────────────────────┘
```

- **Title**: pre-filled with the last commit message of the branch
- **Base branch**: dropdown of remote branches, default to `RemoteInfo.default_branch`
- **Description**: pre-filled with a template (Summary section + Factory UI attribution)
- On success: shows "PR #42 opened ✓" + link to GitHub

---

## UI: GitHub Token in Settings

In `/settings`:

```
── GitHub Integration ──────────────────────────────────────────

  Personal Access Token
  ┌─────────────────────────────────────────────────────────┐
  │ ghp_****...****Ab3c                                      │  (masked)
  └─────────────────────────────────────────────────────────┘
  Connected as: pierre (github.com)            [Update] [Remove]

  Required scope: repo
  How to create a token →  (link to GitHub docs)
```

When no token is set:
```
  ┌─────────────────────────────────────────────────────────┐
  │ ghp_xxxxxxxxxxxxxxxxxxxx                                 │
  └─────────────────────────────────────────────────────────┘
  Requires "repo" scope.                         [Save Token]
```

---

## GitHub Not Configured — Graceful Degradation

If no GitHub token is set OR the project has no `github_remote`:

- Push and PR buttons are hidden in the worktree card
- No error states, just absent functionality
- A subtle hint appears at the bottom of the Worktrees tab:

```
  ⓘ Connect GitHub to push branches and open PRs.
    Configure in Settings →
```

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `PushButton` | `components/project/PushButton.tsx` | Push to GitHub with loading + error state |
| `OpenPRButton` | `components/project/OpenPRButton.tsx` | Open PR or view existing PR |
| `PRCreationForm` | `components/project/PRCreationForm.tsx` | Inline PR creation: title, base, body |
| `GitHubSettings` | `components/settings/GitHubSettings.tsx` | Token input, connection status |
| `GitHubConnectHint` | `components/project/GitHubConnectHint.tsx` | Soft nudge when GitHub not configured |

**TanStack Query hooks**:
- `useGitHubConfig()` — GET /api/settings/github
- `useSaveGitHubToken()` — POST /api/settings/github/token
- `useRemoveGitHubToken()` — DELETE /api/settings/github/token
- `useGitHubRemote(projectId)` — GET /api/projects/{id}/github/remote
- `usePushBranch(projectId)` — POST /api/projects/{id}/github/push
- `useCreatePR(projectId)` — POST /api/projects/{id}/github/pull-request
- `useProjectPRs(projectId)` — GET /api/projects/{id}/github/pull-requests

---

## Acceptance Criteria

**Token setup**
- Given I enter a valid GitHub PAT in Settings, Then my GitHub username is displayed and the token is saved
- Given I enter an invalid token, Then an inline error "Invalid token" appears
- Given I remove the token, Then push and PR buttons disappear from all worktree cards

**Push**
- Given a worktree has commits ahead and GitHub is configured, Then a [Push to GitHub] button is visible
- Given I click Push, Then the branch is pushed to origin and a success indicator appears
- Given the push is rejected due to divergence, Then an error with a [Force push?] option appears

**Pull Request**
- Given a branch is pushed to GitHub, Then an [Open PR] button appears on the worktree card
- Given I fill in the PR form and click Open, Then the PR is created and a link to it is shown
- Given a PR already exists for this branch, Then the button shows "View PR #N →" instead
- Given GitHub is not configured, Then no push or PR buttons are visible on worktree cards

**Settings graceful degradation**
- Given no GitHub token is set, Then a subtle hint appears at the bottom of the Worktrees tab
- Given the project has no github_remote, Then push/PR buttons are absent (no error)

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: GitHub token storage + validation endpoint | S |
| Backend: GET remote info (parse remote URL + fetch default branch) | S |
| Backend: POST push (git push via subprocess) | M |
| Backend: POST pull-request (GitHub API call) | M |
| Backend: GET pull-requests | S |
| Frontend: GitHubSettings (token input, connection status) | M |
| Frontend: PushButton + push feedback | M |
| Frontend: PRCreationForm + OpenPRButton | M |
| Frontend: GitHubConnectHint (graceful degradation) | S |
