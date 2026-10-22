"""
Lyrics service for Neuro Music.
Proxies lrclib.net with validation, caching, and timeout.
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
from backend.models import SearchCache  # Reuse search cache table for lyrics
from sqlalchemy import select
from sqlmodel import Session

logger = logging.getLogger(__name__)

LRCLIB_BASE = "https://lrclib.net/api"
CACHE_TTL_SECONDS = 24 * 60 * 60  # 24 hours
REQUEST_TIMEOUT = 10.0  # seconds


@dataclass
class LyricsResult:
    """Normalized lyrics result."""
    synced_lyrics: list | None = None  # List of {time: float, text: str}
    plain_lyrics: str | None = None
    instrumental: bool = False


def normalize_lyrics_query(title: str, artist: str) -> str:
    """Normalize query for caching."""
    return f"lyrics:{title.strip().lower()}:{artist.strip().lower()}"


def validate_lyrics_input(title: str, artist: str) -> bool:
    """Validate title and artist inputs."""
    if not title or not artist or len(title) > 200 or len(artist) > 200:
        return False
    # Basic sanitization - allow common punctuation
    return True


async def fetch_lyrics_from_lrclib(title: str, artist: str) -> LyricsResult | None:
    """Fetch lyrics from lrclib.net API."""
    if not validate_lyrics_input(title, artist):
        return None
    
    params = {
        "track_name": title,
        "artist_name": artist,
    }
    
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.get(f"{LRCLIB_BASE}/get", params=params)
            
            if resp.status_code == 404:
                return None
            
            resp.raise_for_status()
            data = resp.json()
            
            # Parse synced lyrics if available
            synced = None
            if data.get("syncedLyrics"):
                synced = parse_synced_lyrics(data["syncedLyrics"])
            
            return LyricsResult(
                synced_lyrics=synced,
                plain_lyrics=data.get("plainLyrics"),
                instrumental=data.get("instrumental", False)
            )
    except httpx.TimeoutException:
        logger.warning(f"Lyrics request timeout for {title} - {artist}")
        return None
    except httpx.HTTPStatusError as e:
        logger.error(f"Lyrics API error: {e.response.status_code} for {title} - {artist}")
        return None
    except httpx.RequestError as e:
        logger.error(f"Lyrics request error: {e}")
        return None


def parse_synced_lyrics(lrc_text: str) -> list:
    """Parse LRC format synced lyrics into list of {time, text}."""
    lines = lrc_text.strip().split('\n')
    result = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Parse timestamp [mm:ss.xx] or [mm:ss]
        if line.startswith('['):
            parts = line.split(']', 1)
            if len(parts) == 2:
                timestamp_str = parts[0][1:]  # Remove [
                text = parts[1].strip()
                
                # Parse timestamp
                try:
                    if ':' in timestamp_str:
                        time_parts = timestamp_str.split(':')
                        minutes = int(time_parts[0])
                        seconds = float(time_parts[1])
                        total_seconds = minutes * 60 + seconds
                        result.append({"time": total_seconds, "text": text})
                except (ValueError, IndexError):
                    continue
    
    return result


async def get_cached_lyrics(session: Session, title: str, artist: str) -> LyricsResult | None:
    """Get cached lyrics from database."""
    cache_key = normalize_lyrics_query(title, artist)
    cache_entry = session.exec(
        select(SearchCache).where(SearchCache.key == cache_key)
    ).first()
    
    if not cache_entry:
        return None
    
    # Check if expired
    if cache_entry.expires_at < datetime.now(timezone.utc):
        return None
    
    try:
        payload = cache_entry.payload
        if isinstance(payload, dict):
            return LyricsResult(
                synced_lyrics=payload.get("synced_lyrics"),
                plain_lyrics=payload.get("plain_lyrics"),
                instrumental=payload.get("instrumental", False)
            )
    except (KeyError, TypeError, ValueError) as e:
        logger.error(f"Error loading cached lyrics: {e}")
    return None


async def save_cached_lyrics(session: Session, title: str, artist: str, result: LyricsResult) -> None:
    """Save lyrics to cache."""
    cache_key = normalize_lyrics_query(title, artist)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=CACHE_TTL_SECONDS)
    
    payload = {
        "synced_lyrics": result.synced_lyrics,
        "plain_lyrics": result.plain_lyrics,
        "instrumental": result.instrumental
    }
    
    cache_entry = SearchCache(
        key=cache_key,
        payload=payload,
        expires_at=expires_at,
    )
    
    # Delete any existing entry
    existing = session.exec(select(SearchCache).where(SearchCache.key == cache_key)).first()
    if existing:
        session.delete(existing)
    
    session.add(cache_entry)
    session.commit()


async def get_lyrics_with_cache(session: Session, title: str, artist: str) -> LyricsResult | None:
    """Get lyrics with multi-layer caching."""
    # Try cache first
    cached = await get_cached_lyrics(session, title, artist)
    if cached:
        logger.debug(f"Lyrics cache hit for {title} - {artist}")
        return cached
    
    # Fetch from lrclib
    result = await fetch_lyrics_from_lrclib(title, artist)
    
    if result:
        await save_cached_lyrics(session, title, artist, result)
    
    return result