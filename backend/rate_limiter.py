"""Rate limiting configuration for Neuro Music."""
import logging
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from .config import settings

logger = logging.getLogger(__name__)

# Global limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_REQUESTS}/minute"],
    storage_uri="memory://",
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Custom handler for rate limit exceeded."""
    logger.warning(
        "Rate limit exceeded: ip=%s path=%s limit=%s",
        get_remote_address(request),
        request.url.path,
        exc.limit,
    )
    # RateLimitExceeded may not have retry_after in all versions
    retry_after = getattr(exc, "retry_after", 60)
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": f"Rate limit exceeded: {exc.limit}",
            "retry_after": retry_after,
        },
    )


def setup_rate_limiter(app: FastAPI) -> None:
    """Configure rate limiting for the app."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)


# Decorators for specific endpoints
def search_rate_limit() -> Callable:
    """30 requests per minute for search."""
    return limiter.limit("30/minute")


def auth_rate_limit() -> Callable:
    """10 requests per minute for auth endpoints."""
    return limiter.limit("10/minute")


def default_rate_limit() -> Callable:
    """Default rate limit from config."""
    return limiter.limit(f"{settings.RATE_LIMIT_REQUESTS}/minute")