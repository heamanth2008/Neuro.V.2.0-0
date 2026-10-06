"""
YouTube Data API v3 Search Service for Neuro Music.

This module provides a reliable search implementation using the official
YouTube Data API v3, with proper caching, quota tracking, and error handling.
"""
import asyncio
import hashlib
import logging
import time
from dataclasses import dataclass
from typing import Optional

import httpx
from sqlalchemy import select
from sqlmodel import Session

from backend.config import settings
from backend.models import SearchCache

logger = logging.getLogger(__name__)

# YouTube Data API v3 endpoints
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"
SEARCH_ENDPOINT = f"{YOUTUBE_API_BASE}/search"
VIDEOS_ENDPOINT = f"{YOUTUBE_API_BASE}/videos"

# Cache TTL: 24 hours
CACHE_TTL_SECONDS = 24 * 60 * 60

# In-flight request deduplication
_in_flight_requests: dict[str, asyncio.Future] = {}

# Quota tracking (approximate)
_quota_used = 0
_quota_reset_time = 0


@dataclass
class SearchResult:
    """Normalized search result."""
    yt_id: str
    title: str
    artist: str
    duration: int  # seconds
    thumbnail: str
    grad: str  # fallback gradient


def generate_gradient(yt_id: str) -> str:
    """Generate a deterministic gradient from YouTube video ID."""
    hash_val = sum(ord(c) for c in yt_id)
    hue1 = hash_val % 360
    hue2 = (hue1 + 45) % 360
    return f"linear-gradient(135deg, hsl({hue1}, 80%, 25%), hsl({hue2}, 80%, 40%))"


def parse_duration(duration_str: str) -> int:
    """Parse ISO 8601 duration (PT#H#M#S) to seconds."""
    if not duration_str:
        return 0
    try:
        # PT4M13S -> 4*60 + 13 = 253
        # PT1H2M3S -> 1*3600 + 2*60 + 3 = 3723
        hours = 0
        minutes = 0
        seconds = 0
        
        # Remove PT prefix
        time_str = duration_str.replace("PT", "")
        
        # Parse hours
        if "H" in time_str:
            parts = time_str.split("H")
            hours = int(parts[0])
            time_str = parts[1]
        
        # Parse minutes
        if "M" in time_str:
            parts = time_str.split("M")
            minutes = int(parts[0])
            time_str = parts[1]
        
        # Parse seconds
        if "S" in time_str:
            seconds = int(time_str.replace("S", ""))
        
        return hours * 3600 + minutes * 60 + seconds
    except Exception:
        return 0


def normalize_query(q: str) -> str:
    """Normalize query for caching."""
    return q.strip().lower()


def check_quota() -> bool:
    """Check if we have quota available (very rough estimate)."""
    global _quota_used, _quota_reset_time
    current_time = time.time()
    if current_time > _quota_reset_time:
        _quota_used = 0
        _quota_reset_time = current_time + 86400  # 24 hours
    # YouTube Data API v3 default quota is 10,000 units/day
    # Search costs 100 units, video details costs 1 unit
    return _quota_used < 9000


def increment_quota(cost: int) -> None:
    """Increment quota usage."""
    global _quota_used
    _quota_used += cost


async def fetch_video_details(yt_ids: list[str]) -> dict:
    """Fetch video details (duration, thumbnails) for multiple video IDs."""
    if not yt_ids:
        return {}
    
    # YouTube API allows up to 50 IDs per request
    all_details = {}
    for i in range(0, len(yt_ids), 50):
        batch = yt_ids[i:i+50]
        params = {
            "part": "contentDetails,snippet",
            "id": ",".join(batch),
            "key": settings.YT_API_KEY,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(VIDEOS_ENDPOINT, params=params)
                resp.raise_for_status()
                data = resp.json()
                for item in data.get("items", []):
                    vid = item["id"]
                    duration = parse_duration(item.get("contentDetails", {}).get("duration", ""))
                    thumbnails = item.get("snippet", {}).get("thumbnails", {})
                    # Prefer high quality thumbnail
                    thumbnail = (
                        thumbnails.get("maxres", {}).get("url") or
                        thumbnails.get("high", {}).get("url") or
                        thumbnails.get("medium", {}).get("url") or
                        thumbnails.get("default", {}).get("url") or
                        ""
                    )
                    all_details[vid] = {"duration": duration, "thumbnail": thumbnail}
                increment_quota(1)  # videos.list costs 1 unit per call
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 403 and "quota" in str(e).lower():
                    logger.warning("YouTube API quota exceeded")
                    break
                logger.error("Failed to fetch video details: %s", e)
            except Exception as e:
                logger.error("Error fetching video details: %s", e)
    return all_details


async def search_youtube_data_api(q: str, limit: int = 20) -> list[SearchResult]:
    """
    Search YouTube using the Data API v3.
    
    Returns normalized results with video details.
    """
    if not settings.YT_API_KEY:
        logger.warning("YT_API_KEY not configured")
        return []
    
    if not check_quota():
        logger.warning("YouTube API quota near limit")
        return []
    
    params = {
        "part": "snippet",
        "q": q,
        "type": "video",
        "videoCategoryId": "10",  # Music
        "maxResults": min(limit, 50),
        "key": settings.YT_API_KEY,
        "safeSearch": "none",
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(SEARCH_ENDPOINT, params=params)
            resp.raise_for_status()
            data = resp.json()
            increment_quota(100)  # search.list costs 100 units
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403 and "quota" in str(e).lower():
                logger.warning("YouTube API quota exceeded")
                return []
            logger.error("YouTube search failed: %s", e)
            return []
        except Exception as e:
            logger.error("YouTube search error: %s", e)
            return []
    
    items = data.get("items", [])
    if not items:
        return []
    
    # Extract video IDs
    yt_ids = [item["id"]["videoId"] for item in items if item.get("id", {}).get("videoId")]
    
    # Fetch video details (duration, thumbnails)
    details = await fetch_video_details(yt_ids)
    
    results = []
    for item in items:
        try:
            vid = item["id"]["videoId"]
            snippet = item.get("snippet", {})
            title = snippet.get("title", "Unknown Title")
            channel = snippet.get("channelTitle", "Unknown Artist")
            
            # Get thumbnail (prefer high quality)
            thumbnails = snippet.get("thumbnails", {})
            thumbnail = (
                thumbnails.get("high", {}).get("url") or
                thumbnails.get("medium", {}).get("url") or
                thumbnails.get("default", {}).get("url") or
                ""
            )
            
            # Get duration from fetched details
            duration = details.get(vid, {}).get("duration", 0)
            if not duration:
                # Try to get from details fetched in fetch_video_details
                duration = details.get(vid, {}).get("duration", 0)
            
            # Use channel's thumbnail if available, otherwise video thumbnail
            # For better UX, use the video's own thumbnail
            if not thumbnail:
                thumbnail = details.get(vid, {}).get("thumbnail", "")
            
            results.append(SearchResult(
                yt_id=vid,
                title=title,
                artist=channel,
                duration=duration,
                thumbnail=thumbnail,
                grad=generate_gradient(vid),
            ))
        except Exception as e:
            logger.error("Error parsing search result: %s", e)
    
    return results


async def get_cached_results(session: Session, query: str) -> Optional[list[SearchResult]]:
    """Get cached search results from database."""
    norm_query = normalize_query(query)
    # Use session.get() for primary key lookup - returns model instance directly
    cache_entry = session.get(SearchCache, norm_query)
    
    if not cache_entry:
        return None
    
    # Check if expired - handle naive/aware datetime comparison
    expires_at = cache_entry.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    # Return cached results
    try:
        payload = cache_entry.payload
        if isinstance(payload, dict) and "results" in payload:
            return [SearchResult(**r) for r in payload["results"]]
    except Exception as e:
        logger.error("Error loading cached results: %s", e)
    return None


async def save_cached_results(session: Session, query: str, results: list[SearchResult]) -> None:
    """Save search results to cache."""
    norm_query = normalize_query(query)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=CACHE_TTL_SECONDS)
    
    payload = {
        "results": [
            {
                "yt_id": r.yt_id,
                "title": r.title,
                "artist": r.artist,
                "duration": r.duration,
                "thumbnail": r.thumbnail,
                "grad": r.grad,
            }
            for r in results
        ]
    }
    
    cache_entry = SearchCache(
        key=norm_query,
        payload=payload,
        expires_at=expires_at,
    )
    
    # Delete any existing entry using session.get() for PK lookup
    existing = session.get(SearchCache, norm_query)
    if existing:
        session.delete(existing)
    
    session.add(cache_entry)
    session.commit()


async def search_with_cache(session: Session, q: str, limit: int = 20) -> tuple[list[SearchResult], bool, bool]:
    """
    Search with multi-layer caching:
    1. Try database cache (24h TTL)
    2. If not in cache or expired, call YouTube API
    3. If API fails, try stale cache
    4. Return results with cache status
    
    Returns: (results, from_cache, is_stale)
    """
    # Check for in-flight request
    norm_query = normalize_query(q)
    if norm_query in _in_flight_requests:
        logger.debug("Deduplicating in-flight request for: %s", q)
        return await _in_flight_requests[norm_query]
    
    # Create future for deduplication
    future = asyncio.Future()
    _in_flight_requests[norm_query] = future
    
    try:
        # Try fresh cache first
        cached = await get_cached_results(session, q)
        if cached:
            future.set_result((cached, True, False))
            return cached, True, False
        
        # Try API
        results = await search_youtube_data_api(q, limit)
        
        if results:
            # Save to cache
            await save_cached_results(session, q, results)
            future.set_result((results, False, False))
            return results, False, False
        
        # API returned no results or failed - try stale cache
        cache_entry = session.get(SearchCache, norm_query)
        
        if cache_entry:
            try:
                payload = cache_entry.payload
                if isinstance(payload, dict) and "results" in payload:
                    stale_results = [SearchResult(**r) for r in payload["results"]]
                    logger.info("Serving stale cache for: %s", q)
                    future.set_result((stale_results, True, True))
                    return stale_results, True, True
            except Exception as e:
                logger.error("Error loading stale cache: %s", e)
        
        # No results available
        future.set_result(([], False, False))
        return [], False, False
    finally:
        _in_flight_requests.pop(norm_query, None)


# Import at bottom to avoid circular imports
from datetime import datetime, timezone, timedelta
from typing import Optional