import logging
import socket
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import (
    claude_import,
    code_review,
    git,
    github,
    library,
    projects,
    run,
    runs,
    settings,
    worktrees,
)

LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logger = logging.getLogger("factory")
logger.setLevel(logging.DEBUG)

file_handler = RotatingFileHandler(
    LOG_DIR / "backend.log", maxBytes=5_000_000, backupCount=3
)
file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
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


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


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
