# Spec 11 — Settings

**Domain**: System
**Route**: `/settings`
**Sprint**: 1

---

## Overview

Settings page for global Factory UI configuration. Single page with sections. No per-project settings page in V2 — per-project config (default effort, skip permissions) is edited inline in the project IDE's Launch tab.

V2 cuts: auth/credentials, GitLab token, email/SMTP, notification settings. Keeps: GitHub token, default model, skip permissions, worktree base path, token pricing.

---

## Tech Stack

- **Storage**: `~/.factory-cli.json` (flat JSON, no auth section)
- **Backend**: FastAPI, Pydantic
- **Frontend**: Next.js 15, React Hook Form + zod (import from 'zod/v4')

---

## Data Model

### Settings

```typescript
interface Settings {
  github_token?: string           // GitHub PAT (masked in API response)
  github_username?: string        // cached from token validation
  github_token_valid?: boolean    // last validation result
  default_model: string           // e.g. "claude-sonnet-4-6"
  skip_permissions: boolean       // global default for --dangerously-skip-permissions
  worktree_base_path?: string     // override for worktree directory location
  pricing: PricingConfig
}

interface PricingConfig {
  opus_input: number              // USD per million tokens, default 15.0
  opus_output: number             // default 75.0
  sonnet_input: number            // default 3.0
  sonnet_output: number           // default 15.0
  haiku_input: number             // default 0.8
  haiku_output: number            // default 4.0
}
```

Storage file: `~/.factory-cli.json`

```json
{
  "default_model": "claude-sonnet-4-6",
  "skip_permissions": false,
  "github_token": "ghp_xxxxxxxxxxxx",
  "github_username": "pierre",
  "worktree_base_path": "",
  "pricing": {
    "opus_input": 15.0,
    "opus_output": 75.0,
    "sonnet_input": 3.0,
    "sonnet_output": 15.0,
    "haiku_input": 0.8,
    "haiku_output": 4.0
  }
}
```

---

## API Endpoints

### `GET /api/settings`

Read settings. Sensitive fields masked.

**Response**:
```json
{
  "github_token_set": true,
  "github_token_masked": "ghp_****...****Ab3c",
  "github_username": "pierre",
  "github_token_valid": true,
  "default_model": "claude-sonnet-4-6",
  "skip_permissions": false,
  "worktree_base_path": "",
  "pricing": {
    "opus_input": 15.0,
    "opus_output": 75.0,
    "sonnet_input": 3.0,
    "sonnet_output": 15.0,
    "haiku_input": 0.8,
    "haiku_output": 4.0
  }
}
```

**Masking rules**: GitHub token shows first 4 and last 4 characters: `ghp_****...****Ab3c`. If token is not set, `github_token_set: false` and other github fields are omitted.

---

### `PATCH /api/settings`

Update settings (partial). Never overwrites a secret with an empty string — if `github_token: ""` is sent, it is ignored (use DELETE endpoint to remove).

**Request**: partial Settings object (any subset of fields)

**Response**: updated Settings (masked)

---

### `POST /api/settings/github/token`

Save or update the GitHub PAT. Validates against the GitHub API before storing.

**Request**: `{ "token": "ghp_xxxxxxxxxxxxxxxxxxxx" }`

**Behavior**:
1. Call `GET https://api.github.com/user` with the token
2. If valid: cache username, store token, set `github_token_valid: true`
3. If invalid: return error, do not store

**Response**: `{ "username": "pierre", "valid": true }`

**Errors**: `400 invalid_token` — token rejected by GitHub API

---

### `DELETE /api/settings/github/token`

Remove the stored GitHub token and cached username.

**Response**: `{ "ok": true }`

---

## Page Layout

```
+----------------------------------------------------------------------+
| Sidebar |  Settings                                                    |
|         +------------------------------------------------------------+
|         |                                                            |
|         |  -- GitHub Integration ----------------------------------- |
|         |                                                            |
|         |  Personal Access Token                                     |
|         |  +------------------------------------------------------+  |
|         |  | ghp_****...****Ab3c                                   |  |
|         |  +------------------------------------------------------+  |
|         |  Connected as: pierre (github.com)      [Update] [Remove]  |
|         |  Required scope: repo                                      |
|         |  How to create a token ->  (link to GitHub docs)           |
|         |                                                            |
|         |  -- Claude Defaults -------------------------------------- |
|         |                                                            |
|         |  Default Model                                             |
|         |  [claude-sonnet-4-6 v]                                     |
|         |                                                            |
|         |  Skip Permissions (global default)                         |
|         |  [ ] off                                                   |
|         |  Adds --dangerously-skip-permissions to all runs.          |
|         |  Can be overridden per-run in the Launch panel.            |
|         |                                                            |
|         |  -- Paths ------------------------------------------------ |
|         |                                                            |
|         |  Worktree Base Path (optional)                             |
|         |  +------------------------------------------------------+  |
|         |  |                                                       |  |
|         |  +------------------------------------------------------+  |
|         |  Default: {project}/../{project_name}-worktrees/           |
|         |                                                            |
|         |  -- Token Pricing (USD per million tokens) --------------- |
|         |                                                            |
|         |  Opus    Input: [15.0]    Output: [75.0]                   |
|         |  Sonnet  Input: [3.0]     Output: [15.0]                   |
|         |  Haiku   Input: [0.8]     Output: [4.0]                    |
|         |                                                            |
|         |                                          [Save Changes]     |
|         |                                                            |
+----------------------------------------------------------------------+
```

---

## Sections

### GitHub Integration

**Token set state**:
- Masked token display (read-only input)
- "Connected as: {username}" with green check
- [Update] button: clears the field, shows editable input
- [Remove] button: confirmation dialog, then `DELETE /api/settings/github/token`

**Token not set state**:
- Editable input field (password type)
- [Save Token] button
- On submit: calls `POST /api/settings/github/token`
- On success: shows username, transitions to "token set" state
- On error: inline error "Invalid token — make sure it has the 'repo' scope"

**Help link**: "How to create a token" links to `https://github.com/settings/tokens/new?scopes=repo`

---

### Claude Defaults

**Default Model**: dropdown with options:
- `claude-opus-4-6` — "Opus 4.6 (most capable)"
- `claude-sonnet-4-6` — "Sonnet 4.6 (balanced)" (default)
- `claude-haiku-4-5` — "Haiku 4.5 (fastest)"

**Skip Permissions**: toggle switch
- Warning text below: "Adds `--dangerously-skip-permissions` to all runs. Can be overridden per-run in the Launch panel."
- Default: off

---

### Paths

**Worktree Base Path**: text input
- When empty: shows helper text "Default: `{project_path}/../{project_name}-worktrees/`"
- When set: worktrees are created under this path instead of the default location

---

### Token Pricing

3 rows (Opus, Sonnet, Haiku) x 2 columns (input price, output price).

- Number inputs with step 0.1
- Label: "USD per million tokens"
- These values are used to calculate cost displays throughout the app (run history, cockpit, run header)
- Defaults match current Anthropic pricing

---

## States

| State | Display |
|---|---|
| Loading | Skeleton form |
| Save in progress | Save button shows spinner, form disabled |
| Save success | Success toast "Settings saved" |
| Save error | Error toast with message |
| Token validation in progress | Save Token button shows spinner |
| Token valid | Green check + username |
| Token invalid | Inline error below input |

---

## Components to Build

| Component | File | Description |
|---|---|---|
| `SettingsPage` | `app/(app)/settings/page.tsx` | Root page |
| `SettingsForm` | `components/settings/SettingsForm.tsx` | Full form with all sections |
| `GitHubSettings` | `components/settings/GitHubSettings.tsx` | Token input, validation, connection status |
| `PricingTable` | `components/settings/PricingTable.tsx` | 3x2 grid of pricing inputs |

**TanStack Query hooks**:
- `useSettings()` — GET /api/settings
- `useUpdateSettings()` — PATCH /api/settings
- `useSaveGitHubToken()` — POST /api/settings/github/token
- `useRemoveGitHubToken()` — DELETE /api/settings/github/token

---

## Acceptance Criteria

**GitHub**
- Given I enter a valid GitHub PAT and click Save Token, Then my username is displayed and the token is stored
- Given I enter an invalid token, Then an inline error "Invalid token" appears and the token is not stored
- Given I click Remove and confirm, Then the token is deleted and GitHub features (push, PR) are disabled across the app
- Given I click Update, Then the token field becomes editable for entering a new token

**Claude Defaults**
- Given I change the default model to Opus, Then new runs use `claude-opus-4-6`
- Given I toggle skip_permissions on, Then new runs include `--dangerously-skip-permissions` by default
- Given skip_permissions is on globally but I toggle it off for a specific run, Then that run does not skip permissions

**Pricing**
- Given I update Sonnet input price to 5.0, Then cost calculations in run history and cockpit reflect the new rate
- Given I leave pricing at defaults, Then costs match current Anthropic pricing

**General**
- Given I change any setting and click Save Changes, Then the changes are persisted and a success toast appears
- Given I reload the page, Then all previously saved settings are restored
- Given the settings file does not exist, Then defaults are used and the form is populated with default values

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Backend: settings service (read/write ~/.factory-cli.json, masking) | S |
| Backend: GET/PATCH /api/settings | S |
| Backend: POST/DELETE /api/settings/github/token (validation) | S |
| Frontend: SettingsPage + SettingsForm layout | M |
| Frontend: GitHubSettings (token flow, validation, connection status) | M |
| Frontend: PricingTable (number inputs) | S |
