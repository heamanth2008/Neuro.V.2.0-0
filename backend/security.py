"""Security middleware for Neuro Music."""
import logging
from collections.abc import Callable
from urllib.parse import urlparse

from fastapi import FastAPI, Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    def __init__(self, app: FastAPI):
        super().__init__(app)
        self.is_prod = settings.is_production

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "img-src 'self' https://*.ytimg.com https://*.googleusercontent.com https://i.ytimg.com data: blob:; "
            "frame-src https://www.youtube.com https://www.youtube-nocookie.com; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "connect-src 'self' https://lrclib.net https://www.youtube.com https://*.googleusercontent.com; "
            "media-src 'self' data: blob:; "
            "font-src 'self' data: https://fonts.gstatic.com; "
            "manifest-src 'self'; "
            "worker-src 'self' blob:; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response.headers["Content-Security-Policy"] = csp

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        if self.is_prod:
            # HSTS - 1 year, include subdomains, preload
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """Validate Origin/Referer header for mutating requests."""

    def __init__(self, app: FastAPI):
        super().__init__(app)
        self.allowed_origins: set[str] = set(settings.allowed_origins_list)
        # Methods that require CSRF protection
        self.protected_methods = {"POST", "PUT", "PATCH", "DELETE"}
        # Allow disabling CSRF for testing
        self.enabled = settings.ENV != "test"

    def _get_origin(self, request: Request) -> str:
        """Extract origin from request headers."""
        origin = request.headers.get("origin")
        if origin:
            return origin.rstrip("/")

        # Fallback to referer
        referer = request.headers.get("referer")
        if referer:
            try:
                parsed = urlparse(referer)
                return f"{parsed.scheme}://{parsed.netloc}"
            except (ValueError, AttributeError):
                logger.debug("Failed to parse referer header: %s", referer)

        return ""

    def _is_allowed_origin(self, origin: str) -> bool:
        """Check if origin is in allowed list."""
        if not origin:
            return False

        for allowed in self.allowed_origins:
            if allowed == "*":
                return True
            if allowed.rstrip("/") == origin:
                return True
        return False

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip CSRF check if disabled (e.g., in tests)
        if not self.enabled:
            return await call_next(request)

        # Skip CSRF check for non-mutating methods
        if request.method not in self.protected_methods:
            return await call_next(request)

        # Skip for OPTIONS (preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip for health and static endpoints
        if request.url.path in ("/api/health", "/health"):
            return await call_next(request)

        # Check Origin/Referer
        origin = self._get_origin(request)

        if not origin or not self._is_allowed_origin(origin):
            logger.warning(
                "CSRF rejected: method=%s path=%s origin=%s allowed=%s",
                request.method,
                request.url.path,
                origin,
                self.allowed_origins,
            )
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Invalid origin"},
            )

        return await call_next(request)


def setup_security_middleware(app: FastAPI) -> None:
    """Add security middleware to the app."""
    # Order matters: CSRF first, then SecurityHeaders
    app.add_middleware(CSRFMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)