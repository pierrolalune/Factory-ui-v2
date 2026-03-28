# Contributing to Factory UI V2

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- pnpm 9+ (`corepack enable && corepack prepare pnpm@9 --activate`)

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd FactoryV2

# Install backend dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd frontend && pnpm install && cd ..

# Start both servers
./start.ps1          # Windows
./start.sh           # macOS/Linux/WSL
```

### Development

```bash
# Backend (from project root, never from inside backend/)
py -m uvicorn backend.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && pnpm dev

# LAN mode (access from phone)
./start-lan.ps1
```

## Testing

```bash
# Backend
pytest backend/tests/ -v

# Frontend
cd frontend && pnpm lint && pnpm typecheck

# E2E (local only, needs running backend)
cd frontend && pnpm test
```

## Code Style

### Backend (Python)

- Ruff for linting: `ruff check backend/`
- Line length: 120
- Pydantic V2 models in `backend/schemas/`
- All endpoints under `/api/` prefix
- JSON responses use `snake_case` keys

### Frontend (TypeScript/React)

- ESLint 9 flat config
- TypeScript strict mode, no `any`
- Prettier: no semicolons, double quotes, trailing commas, 100 char width
- Zod v4 schemas convert API `snake_case` to frontend `camelCase`
- Path alias: `@/*` maps to `./src/*`

## Branching

- `main` — stable, deployable
- `feat/{name}` — feature branches
- `fix/{name}` — bug fixes
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`

## Design System

All UI must follow `DESIGN.md`. Key rules:

- Use design tokens, never hardcoded colors/spacing
- DM Sans for UI, DM Mono for code/terminal
- 8px base spacing, all multiples of 4px
- Lucide React for all icons
