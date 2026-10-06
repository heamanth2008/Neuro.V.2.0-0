"""Neuro Music FastAPI Application."""
import logging
import os
import subprocess
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import settings
from .db import create_db_and_tables, engine, get_session
from .models import SQLModel
from .auth import router as auth_router
from .api.user_data import router as user_data_router
from .security import setup_security_middleware
from .rate_limiter import setup_rate_limiter, search_rate_limit, auth_rate_limit, default_rate_limit
from .services.yt_search import search_with_cache, SearchResult

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.ENV == "dev" else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Path to frontend directory
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")


def run_migrations() -> None:
    """Run Alembic migrations on startup."""
    if settings.ENV == "prod":
        try:
            result = subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                cwd=os.path.dirname(__file__),
                capture_output=True,
                text=True,
                check=True,
            )
            logger.info("Alembic upgrade output: %s", result.stdout)
        except subprocess.CalledProcessError as e:
            logger.error("Alembic upgrade failed: %s", e.stderr)
    else:
        create_db_and_tables()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting Neuro Music Backend...")
    run_migrations()
    yield
    logger.info("Shutting down Neuro Music Backend...")
    engine.dispose()


app = FastAPI(
    title="Neuro Music API",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS configuration - explicit origins with credentials
cors_origins = settings.allowed_origins_list
if "*" in cors_origins:
    # Don't allow wildcard with credentials - use explicit list
    cors_origins = ["http://localhost:3000", "http://localhost:8000"]
    logger.warning("Wildcard CORS not allowed with credentials; using fallback origins")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "Referer"],
    expose_headers=["Content-Disposition"],
    max_age=600,
)

# Security middleware (CSRF + Security Headers)
setup_security_middleware(app)

# Rate limiting
setup_rate_limiter(app)

# Include auth router
app.include_router(auth_router)
app.include_router(user_data_router)


# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler - never leak stack traces."""
    logger.exception("Unhandled exception: %s %s", request.method, request.url.path)
    if settings.ENV == "dev":
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "error": str(exc)},
        )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# --- Health endpoint ---
@app.get("/api/health")
@app.get("/health")
def health():
    """Health check endpoint with app version."""
    return {
        "status": "ok",
        "service": "Neuro Music",
        "version": settings.APP_VERSION,
        "timestamp": int(time.time()),
    }


# --- Search endpoint with rate limit ---
class SearchResponse(BaseModel):
    results: list[dict]
    cached: bool
    stale: bool = False


@app.get("/api/search", response_model=SearchResponse)
@search_rate_limit()
async def search_music(
    q: str = Query(..., min_length=1, max_length=100, description="Search query"),
    request: Request = None,
):
    q = q.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Search query is required")
    
    # Get DB session
    db = next(get_session())
    try:
        results, from_cache, is_stale = await search_with_cache(db, q, limit=20)
    finally:
        db.close()
    
    # Convert SearchResult to dict for response
    formatted_results = []
    for idx, item in enumerate(results):
        formatted_results.append({
            "id": hash(item.yt_id) % 1000000 + idx,
            "ytId": item.yt_id,
            "title": item.title,
            "artist": item.artist,
            "album": "",  # Not available from YouTube Data API v3 search
            "dur": item.duration,
            "icon": "music",
            "grad": item.grad,
            "genre": "YouTube Music",
            "thumbnail": item.thumbnail,
        })
    
    return {"results": formatted_results, "cached": from_cache, "stale": is_stale}


# --- Static pages ---
@app.get("/login")
def serve_login():
    return FileResponse(os.path.join(FRONTEND_DIR, "login.html"))


@app.get("/")
def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "glass_home.html"))


# Mount all other static assets (CSS, JS, images, etc.)
app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")


if __name__ == "__main__":
    logger.info("Starting Neuro Music Backend on http://localhost:8000")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)