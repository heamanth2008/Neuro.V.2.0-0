"""Backend services package."""
from .yt_search import (
    SearchResult,
    search_with_cache,
    search_youtube_data_api,
    generate_gradient,
    normalize_query,
    parse_duration,
)

__all__ = [
    "SearchResult",
    "search_with_cache",
    "search_youtube_data_api",
    "generate_gradient",
    "normalize_query",
    "parse_duration",
]