# Spec 14 — DevOps & Project Initialization

**Domain**: Infrastructure
**Sprint**: 0 (before any feature work)

---

## Overview

This spec defines the complete project scaffolding, tooling, scripts, CI, and developer experience setup for Factory UI V2. It is the first thing executed — Sprint 0 — before any feature code is written.

The project is a monorepo with a FastAPI backend and Next.js 15 frontend. Includes optional Docker Compose for one-command startup and GitHub Actions for lint + test on every push.

---

## Repository Structure

```
UI-FactoryV2/
    .github/
        workflows/
            ci.yml                    # Lint + test on push/PR
    backend/
        __init__.py
        main.py                       # FastAPI app entry point
        routers/
            __init__.py
            projects.py
            run.py
            runs.py
            library.py
            claude_import.py
            code_review.py
            git.py
            worktrees.py
            github.py
            settings.py
        services/
            __init__.py
            process_manager.py
            pty_backend.py
            project_service.py
            run_history_service.py
            run_output_service.py
            library_service.py
            claude_folder_scanner.py
            claude_session_service.py
            claude_cli.py
            git_service.py
            worktree_service.py
            github_service.py
            code_review_service.py
            settings_service.py
        schemas/
            __init__.py
            project.py
            run.py
            library.py
            worktree.py
            code_review.py
            settings.py
        tests/
            __init__.py
            conftest.py               # Shared fixtures (tmp dirs, mock projects)
            test_projects.py
            test_runs.py
            test_library.py
            test_git.py
            test_settings.py
    frontend/
        src/
            app/
                (app)/
                    page.tsx          # Cockpit
                    projects/
                    runs/
                    library/
                    settings/
                    layout.tsx        # App layout (shell wrapper)
                layout.tsx            # Root layout (fonts, globals)
                globals.css
            components/
                shell/
                cockpit/
                project/
                terminal/
                library/
                runs/
                code-review/
                settings/
            hooks/
            store/
            lib/
                api/
                    client.ts
                    schemas/
                constants.ts
                utils/
        public/
        e2e/
            smoke.spec.ts            # Basic smoke test
        package.json
        tsconfig.json
        next.config.ts
        postcss.config.mjs
        eslint.config.mjs
        playwright.config.ts
    ClaudeLibrairy/
        _index.json
        items/
    Docs/
        00-index.md
        ...
    logs/                             # Git-ignored, created at runtime
    CLAUDE.md
    DESIGN.md
    CONTRIBUTING.md
    .gitignore
    .editorconfig
    .prettierrc
    start.sh                          # Bash: start both servers (localhost)
    start.ps1                         # PowerShell: start both servers (localhost)
    start-lan.ps1                     # PowerShell: start both servers (LAN mode)
    docker-compose.yml                # Optional: one-command startup
    Dockerfile.backend
    Dockerfile.frontend
    requirements.txt                  # Backend Python dependencies
    pyproject.toml                    # Backend project metadata + tool config
```

---

## Tech Stack Versions

| Component | Version | Notes |
|---|---|---|
| Python | 3.11+ | Use `py` on Windows, `python3` on Unix |
| Node.js | 18+ | LTS recommended |
| pnpm | 9+ | Frontend package manager |
| Next.js | 15 | App Router |
| React | 19 | |
| TypeScript | 5 | Strict mode |
| Tailwind CSS | 4 | Via PostCSS plugin |
| FastAPI | 0.115+ | |
| Pydantic | 2.10+ | V2 models |
| ESLint | 9 | Flat config |
| Playwright | 1.50+ | E2E testing |
| pytest | 8+ | Backend testing |

---

## Backend Setup

### `requirements.txt`

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
websockets==14.1
pydantic==2.10.4
httpx==0.28.1
pywinpty==2.0.14; sys_platform == "win32"
```

No auth libraries (bcrypt, python-jose removed). No email (aiosmtplib removed).

### `pyproject.toml`

```toml
[project]
name = "factory-ui-backend"
version = "2.0.0"
requires-python = ">=3.11"

[tool.ruff]
target-version = "py311"
line-length = 120
select = ["E", "F", "I", "W"]
ignore = ["E501"]

[tool.ruff.isort]
known-first-party = ["backend"]

[tool.pytest.ini_options]
testpaths = ["backend/tests"]
pythonpath = ["."]
```

### `backend/main.py` (scaffold)

```python
import logging
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Routers
from backend.routers import (
    projects, run, runs, library, claude_import,
    code_review, git, worktrees, github, settings,
)

# Logging
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logger = logging.getLogger("factory")
logger.setLevel(logging.DEBUG)

file_handler = RotatingFileHandler(
    LOG_DIR / "backend.log", maxBytes=5_000_000, backupCount=3
)
file_handler.setFormatter(logging.Formatter(
    "%(asctime)s %(levelname)s %(name)s %(message)s"
))
logger.addHandler(file_handler)
logger.addHandler(logging.StreamHandler())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: recover interrupted runs. Shutdown: terminate active runs."""
    from backend.services.process_manager import process_manager
    process_manager.recover_interrupted_runs()
    yield
    process_manager.terminate_all()


app = FastAPI(
    title="Factory UI",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — auto-detect LAN IPs for mobile access
import socket

def _get_allowed_origins() -> list[str]:
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip.startswith(("192.168.", "10.", "172.")):
                origins.append(f"http://{ip}:3000")
    except Exception:
        pass
    return origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}

# Mount routers
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(run.router, prefix="/api/run", tags=["run"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(library.router, prefix="/api/library", tags=["library"])
app.include_router(claude_import.router, prefix="/api/library/claude-import", tags=["import"])
app.include_router(code_review.router, prefix="/api/projects/{project_id}/code-review", tags=["code-review"])
app.include_router(git.router, prefix="/api/projects/{project_id}/git", tags=["git"])
app.include_router(worktrees.router, prefix="/api/projects/{project_id}/worktrees", tags=["worktrees"])
app.include_router(github.router, prefix="/api", tags=["github"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
```

### Run backend

```bash
# From project root (NOT from inside backend/)
py -m uvicorn backend.main:app --reload --port 8000

# LAN mode (mobile access)
py -m uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0
```

---

## Frontend Setup

### `frontend/package.json`

```json
{
  "name": "factory-ui-v2",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "typecheck": "tsc --noEmit",
    "test": "playwright test",
    "test:ui": "playwright test --ui"
  },
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "zustand": "^5",
    "@tanstack/react-query": "^5",
    "react-hook-form": "^7",
    "zod": "^4",
    "@xterm/xterm": "^6",
    "@xterm/addon-fit": "^0.11",
    "@xyflow/react": "^12",
    "dagre": "^0.8",
    "@codemirror/view": "^6",
    "@codemirror/lang-javascript": "^6",
    "@codemirror/lang-python": "^6",
    "@codemirror/lang-json": "^6",
    "@codemirror/lang-markdown": "^6",
    "@codemirror/lang-css": "^6",
    "@codemirror/lang-html": "^6",
    "lucide-react": "^0.400",
    "react-markdown": "^10",
    "remark-gfm": "^4"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/dagre": "^0.7",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "eslint": "^9",
    "eslint-config-next": "^15",
    "@playwright/test": "^1.50"
  }
}
```

### `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "e2e"]
}
```

### `frontend/next.config.ts`

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // React Compiler for performance (optional, enable when stable)
  // experimental: { reactCompiler: true },
}

export default nextConfig
```

### `frontend/postcss.config.mjs`

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
export default config
```

### `frontend/eslint.config.mjs`

```javascript
import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "build/**"],
  },
]

export default eslintConfig
```

### `frontend/playwright.config.ts`

```typescript
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev --port 3001",
    port: 3001,
    timeout: 120000,
    reuseExistingServer: true,
  },
})
```

### Run frontend

```bash
cd frontend
pnpm install
pnpm dev

# LAN mode
pnpm dev --hostname 0.0.0.0
```

---

## Startup Scripts

### `start.sh` (Bash — macOS/Linux/WSL)

```bash
#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting Factory UI V2...${NC}"

# Create logs directory
mkdir -p logs

# Start backend
echo -e "${GREEN}Starting backend on :8000...${NC}"
py -m uvicorn backend.main:app --reload --port 8000 --host 127.0.0.1 > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Start frontend
echo -e "${GREEN}Starting frontend on :3000...${NC}"
cd frontend && pnpm dev --hostname 127.0.0.1 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}Backend:  http://127.0.0.1:8000${NC}"
echo -e "${GREEN}Frontend: http://127.0.0.1:3000${NC}"
echo ""
echo "Press Ctrl+C to stop."

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    wait $FRONTEND_PID 2>/dev/null
    echo "Done."
}
trap cleanup EXIT INT TERM

wait
```

### `start.ps1` (PowerShell — Windows localhost)

```powershell
Write-Host "Starting Factory UI V2..." -ForegroundColor Cyan

# Create logs directory
New-Item -ItemType Directory -Force -Path logs | Out-Null

# Kill stale processes on ports 8000, 3000
foreach ($port in 8000, 3000) {
    $pids = netstat -ano | Select-String ":$port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Sort-Object -Unique
    foreach ($pid in $pids) {
        if ($pid -and $pid -ne "0") {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    }
}

# Start backend
Write-Host "Starting backend on :8000..." -ForegroundColor Green
$backend = Start-Process -NoNewWindow -PassThru -FilePath "py" `
    -ArgumentList "-m", "uvicorn", "backend.main:app", "--reload", "--port", "8000", "--host", "127.0.0.1" `
    -RedirectStandardOutput "logs\backend.log" -RedirectStandardError "logs\backend-err.log"

# Start frontend
Write-Host "Starting frontend on :3000..." -ForegroundColor Green
$frontend = Start-Process -NoNewWindow -PassThru -WorkingDirectory "frontend" `
    -FilePath "pnpm" -ArgumentList "dev", "--hostname", "127.0.0.1" `
    -RedirectStandardOutput "..\logs\frontend.log" -RedirectStandardError "..\logs\frontend-err.log"

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

try {
    Wait-Process -Id $backend.Id, $frontend.Id
} finally {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Shutdown complete." -ForegroundColor Cyan
}
```

### `start-lan.ps1` (PowerShell — Windows LAN mode)

Same as `start.ps1` but:
- Backend: `--host 0.0.0.0`
- Frontend: `--hostname 0.0.0.0`
- Auto-detect LAN IP and display: `http://{LAN_IP}:3000`

---

## Docker (Optional)

### `Dockerfile.backend`

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY ClaudeLibrairy/ ClaudeLibrairy/

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `Dockerfile.frontend`

```dockerfile
FROM node:18-slim

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ .
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
```

### `docker-compose.yml`

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8000:8000"
    volumes:
      - ~/.factory-cli.json:/root/.factory-cli.json
      - ~/.factory-cli-projects.json:/root/.factory-cli-projects.json
      - ~/.factory-projects:/root/.factory-projects
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped
```

**Note**: Docker is optional. The primary dev workflow is running both servers directly. Docker is provided for deployment convenience. Claude CLI must be available inside the backend container for runs to work — in practice, most users will run natively.

---

## Git Setup

### `.gitignore`

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
venv/
env/

# Node
node_modules/
.next/
out/
build/

# Logs
logs/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test artifacts
test-results/
playwright-report/
blob-report/

# Runtime data
*.output.gz

# Factory data (user-specific, not tracked)
# Note: ClaudeLibrairy/ IS tracked (contains builtin library items)
```

### `.editorconfig`

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.py]
indent_size = 4

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

### `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### Branch Strategy

- `main` — stable, deployable
- `feat/{name}` — feature branches
- `fix/{name}` — bug fixes
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`

---

## CI — GitHub Actions

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  backend-lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install ruff pytest

      - name: Lint (ruff)
        run: ruff check backend/

      - name: Test
        run: pytest backend/tests/ -v

  frontend-lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node 18
        uses: actions/setup-node@v4
        with:
          node-version: "18"

      - name: Install pnpm
        run: corepack enable && corepack prepare pnpm@9 --activate

      - name: Install dependencies
        working-directory: frontend
        run: pnpm install --frozen-lockfile

      - name: Lint
        working-directory: frontend
        run: pnpm lint

      - name: Type check
        working-directory: frontend
        run: pnpm typecheck

      - name: Build
        working-directory: frontend
        run: pnpm build
```

This runs on every push to `main` and every PR. Two parallel jobs: backend (lint + test) and frontend (lint + typecheck + build).

E2E tests are not in CI (they need Claude CLI and a running backend with live PTY — not practical in CI without significant mocking). Run E2E locally before merging.

---

## Logging

| Logger | File | Rotation | Level |
|---|---|---|---|
| Backend (FastAPI) | `logs/backend.log` | 5MB, 3 backups | DEBUG |
| Uvicorn access | `logs/backend.log` | (same handler) | INFO |
| Frontend (Next.js) | `logs/frontend.log` | Not rotated (dev only) | — |

Runtime log directory `logs/` is git-ignored and created automatically on startup.

---

## API Conventions

| Convention | Rule |
|---|---|
| Response format | JSON, `snake_case` keys |
| Frontend transform | Zod schemas convert `snake_case` to `camelCase` |
| Error format | `{ "detail": "message", "code": "error_code" }` |
| Auth | None (single-user, no JWT/cookies) |
| CORS | Auto-detect localhost + LAN IPs on port 3000 |
| API prefix | All endpoints under `/api/` |
| WebSocket prefix | `/ws/run/{run_id}` (no auth ticket needed in V2) |
| Health check | `GET /api/health` returns `{ "status": "ok", "version": "2.0.0" }` |

---

## Environment Variables

No `.env` file is required for local development. Everything uses sensible defaults.

| Variable | Default | Purpose |
|---|---|---|
| `FACTORY_PORT_BACKEND` | `8000` | Backend port override |
| `FACTORY_PORT_FRONTEND` | `3000` | Frontend port override |
| `FACTORY_HOST` | `127.0.0.1` | Bind address (set to `0.0.0.0` for LAN) |

The frontend auto-detects the backend URL from `window.location.hostname`:
```typescript
const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1"
export const API_BASE_URL = `http://${host}:8000`
export const WS_BASE_URL = `ws://${host}:8000`
```

---

## Sprint 0 Checklist

This is the ordered list of tasks to bootstrap the project before Sprint 1 begins.

| # | Task | Owner | Output |
|---|---|---|---|
| 1 | Create Git repo, push initial commit | DevOps | Empty repo with `.gitignore`, `.editorconfig`, `.prettierrc` |
| 2 | Create `requirements.txt` + `pyproject.toml` | DevOps | Backend deps pinned |
| 3 | Scaffold `backend/main.py` with health check, CORS, logging, lifespan | DevOps | `GET /api/health` returns 200 |
| 4 | Create empty router + service stubs (all 10 routers, all 14 services) | DevOps | Imports work, app starts with no errors |
| 5 | Create `frontend/package.json` + all config files | DevOps | `pnpm install && pnpm dev` works |
| 6 | Scaffold Next.js app: root layout, `(app)` layout, all 9 page stubs | DevOps | All routes render a placeholder |
| 7 | Create `globals.css` with Tailwind + design tokens from `DESIGN.md` | DevOps | Colors, fonts, spacing available |
| 8 | Create startup scripts: `start.sh`, `start.ps1`, `start-lan.ps1` | DevOps | One-command startup works |
| 9 | Create `docker-compose.yml` + Dockerfiles | DevOps | `docker compose up` starts both servers |
| 10 | Create `.github/workflows/ci.yml` | DevOps | CI runs lint + test on push |
| 11 | Create `frontend/e2e/smoke.spec.ts` | DevOps | Basic smoke test: app loads, health check passes |
| 12 | Create `backend/tests/conftest.py` + `test_health.py` | DevOps | `pytest` passes with health check test |
| 13 | Create `CONTRIBUTING.md` | DevOps | Setup instructions, conventions, PR workflow |
| 14 | Create `CLAUDE.md` | DevOps | Project overview for AI context |
| 15 | Copy `ClaudeLibrairy/` skeleton (empty `_index.json` + `items/`) | DevOps | Library storage ready |
| 16 | Verify: `start.ps1` runs, health check passes, frontend loads | DevOps | Green light for Sprint 1 |

---

## Acceptance Criteria

**Backend**
- Given I run `py -m uvicorn backend.main:app --port 8000`, Then the server starts without errors
- Given I call `GET /api/health`, Then I receive `{ "status": "ok", "version": "2.0.0" }`
- Given I run `ruff check backend/`, Then no lint errors are reported
- Given I run `pytest backend/tests/`, Then all tests pass

**Frontend**
- Given I run `cd frontend && pnpm install && pnpm dev`, Then the dev server starts on port 3000
- Given I open `http://localhost:3000`, Then a page renders (even if just a placeholder)
- Given I run `pnpm lint`, Then no lint errors are reported
- Given I run `pnpm typecheck`, Then no TypeScript errors are reported
- Given I run `pnpm build`, Then the production build succeeds

**Scripts**
- Given I run `./start.sh` (or `start.ps1`), Then both backend and frontend start
- Given I press Ctrl+C, Then both processes are terminated cleanly

**Docker**
- Given I run `docker compose up --build`, Then both containers start and health check passes
- Given I open `http://localhost:3000`, Then the frontend loads

**CI**
- Given I push to `main`, Then the GitHub Actions workflow runs backend lint+test and frontend lint+typecheck+build
- Given all checks pass, Then the workflow shows green

**Developer Experience**
- Given a new developer clones the repo, Then they can start developing within 5 minutes following `CONTRIBUTING.md`
- Given the repo is cloned on Windows, macOS, or Linux, Then `start.sh` or `start.ps1` works without modification

---

## Sprint Sizing Notes

| Ticket | Size |
|---|---|
| Git repo + gitignore + editorconfig + prettierrc | S |
| Backend scaffold (main.py, router/service stubs, requirements, pyproject) | M |
| Frontend scaffold (package.json, configs, page stubs, globals.css) | M |
| Startup scripts (start.sh, start.ps1, start-lan.ps1) | S |
| Docker setup (Dockerfiles + compose) | M |
| CI workflow (GitHub Actions) | S |
| Smoke tests (backend pytest + frontend Playwright) | S |
| CONTRIBUTING.md + CLAUDE.md | S |
| Library skeleton (ClaudeLibrairy/) | S |
| End-to-end verification (all platforms) | M |
