"""Tests for lyrics service."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta

from backend.services.lyrics import (
    normalize_lyrics_query,
    validate_lyrics_input,
    parse_synced_lyrics,
    fetch_lyrics_from_lrclib,
    get_cached_lyrics,
    save_cached_lyrics,
    get_lyrics_with_cache,
    LyricsResult,
)
from backend.models import SearchCache


class TestLyricsNormalization:
    def test_normalize_lyrics_query(self):
        assert normalize_lyrics_query("Hello", "World") == "lyrics:hello:world"
        assert normalize_lyrics_query("  Hello  ", "  World  ") == "lyrics:hello:world"
        assert normalize_lyrics_query("Test", "Artist") == "lyrics:test:artist"

    def test_validate_lyrics_input_valid(self):
        assert validate_lyrics_input("Hello", "World") is True
        assert validate_lyrics_input("A" * 200, "B" * 200) is True

    def test_validate_lyrics_input_invalid(self):
        assert validate_lyrics_input("", "World") is False
        assert validate_lyrics_input("Hello", "") is False
        assert validate_lyrics_input("A" * 201, "World") is False
        assert validate_lyrics_input("Hello", "B" * 201) is False


class TestParseSyncedLyrics:
    def test_parse_synced_lyrics_basic(self):
        lrc = "[00:12.50]Line 1\n[00:15.00]Line 2"
        result = parse_synced_lyrics(lrc)
        assert len(result) == 2
        assert result[0] == {"time": 12.5, "text": "Line 1"}
        assert result[1] == {"time": 15.0, "text": "Line 2"}

    def test_parse_synced_lyrics_with_minutes(self):
        lrc = "[01:30.00]One minute thirty"
        result = parse_synced_lyrics(lrc)
        assert result[0]["time"] == 90.0

    def test_parse_synced_lyrics_ignores_invalid(self):
        lrc = "Invalid line\n[00:10.00]Valid"
        result = parse_synced_lyrics(lrc)
        assert len(result) == 1
        assert result[0]["text"] == "Valid"

    def test_parse_synced_lyrics_empty(self):
        assert parse_synced_lyrics("") == []
        assert parse_synced_lyrics("   ") == []


class TestFetchLyricsFromLrclib:
    @pytest.mark.asyncio
    async def test_fetch_lyrics_success(self):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "syncedLyrics": "[00:00.00]Test lyrics",
            "plainLyrics": "Test lyrics",
            "instrumental": False,
        }

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            result = await fetch_lyrics_from_lrclib("Test Song", "Test Artist")

        assert result is not None
        assert result.plain_lyrics == "Test lyrics"
        assert result.instrumental is False
        assert len(result.synced_lyrics) == 1

    @pytest.mark.asyncio
    async def test_fetch_lyrics_not_found(self):
        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            result = await fetch_lyrics_from_lrclib("Unknown", "Unknown")

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_lyrics_timeout(self):
        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            import httpx
            mock_get.side_effect = httpx.TimeoutException("Timeout")
            result = await fetch_lyrics_from_lrclib("Test", "Artist")

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_lyrics_http_error(self):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.raise_for_status.side_effect = Exception("Server error")

        with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            result = await fetch_lyrics_from_lrclib("Test", "Artist")

        assert result is None


class TestLyricsCache:
    @pytest.fixture
    def session(self):
        from backend.db import get_session, create_db_and_tables, engine
        from sqlmodel import SQLModel
        SQLModel.metadata.create_all(engine)
        db = next(get_session())
        yield db
        db.close()

    def test_get_cached_lyrics_miss(self, session):
        import asyncio
        result = asyncio.run(get_cached_lyrics(session, "Test", "Artist"))
        assert result is None

    def test_get_cached_lyrics_hit(self, session):
        import asyncio
        cache_key = "lyrics:test:artist"
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        cache_entry = SearchCache(
            key=cache_key,
            payload={"synced_lyrics": [{"time": 0, "text": "Cached"}], "plain_lyrics": "Cached", "instrumental": False},
            expires_at=expires_at,
        )
        session.add(cache_entry)
        session.commit()

        result = asyncio.run(get_cached_lyrics(session, "Test", "Artist"))
        assert result is not None
        assert result.plain_lyrics == "Cached"

    def test_get_cached_lyrics_expired(self, session):
        import asyncio
        cache_key = "lyrics:test:artist"
        expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        cache_entry = SearchCache(
            key=cache_key,
            payload={"plain_lyrics": "Expired"},
            expires_at=expires_at,
        )
        session.add(cache_entry)
        session.commit()

        result = asyncio.run(get_cached_lyrics(session, "Test", "Artist"))
        assert result is None

    def test_save_cached_lyrics(self, session):
        import asyncio
        result = LyricsResult(
            synced_lyrics=[{"time": 0, "text": "Saved"}],
            plain_lyrics="Saved",
            instrumental=False,
        )
        asyncio.run(save_cached_lyrics(session, "Test", "Artist", result))

        cache_entry = session.get(SearchCache, "lyrics:test:artist")
        assert cache_entry is not None
        assert cache_entry.payload["plain_lyrics"] == "Saved"


class TestGetLyricsWithCache:
    @pytest.mark.asyncio
    async def test_get_lyrics_with_cache_hit(self):
        mock_session = MagicMock()
        mock_session.get.return_value = MagicMock(
            payload={"plain_lyrics": "Cached"},
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )

        with patch("backend.services.lyrics.get_cached_lyrics", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = LyricsResult(plain_lyrics="Cached")
            result = await get_lyrics_with_cache(mock_session, "Test", "Artist")

        assert result.plain_lyrics == "Cached"
        mock_get.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_lyrics_with_cache_miss_fetch(self):
        mock_session = MagicMock()

        with patch("backend.services.lyrics.get_cached_lyrics", new_callable=AsyncMock) as mock_get:
            with patch("backend.services.lyrics.fetch_lyrics_from_lrclib", new_callable=AsyncMock) as mock_fetch:
                with patch("backend.services.lyrics.save_cached_lyrics", new_callable=AsyncMock) as mock_save:
                    mock_get.return_value = None
                    mock_fetch.return_value = LyricsResult(plain_lyrics="Fetched")

                    result = await get_lyrics_with_cache(mock_session, "Test", "Artist")

        assert result.plain_lyrics == "Fetched"
        mock_fetch.assert_called_once()
        mock_save.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_lyrics_with_cache_fetch_fails(self):
        mock_session = MagicMock()

        with patch("backend.services.lyrics.get_cached_lyrics", new_callable=AsyncMock) as mock_get:
            with patch("backend.services.lyrics.fetch_lyrics_from_lrclib", new_callable=AsyncMock) as mock_fetch:
                mock_get.return_value = None
                mock_fetch.return_value = None

                result = await get_lyrics_with_cache(mock_session, "Test", "Artist")

        assert result is None