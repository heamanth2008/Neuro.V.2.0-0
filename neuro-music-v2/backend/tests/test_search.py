"""Tests for YouTube search service with caching."""
import os
os.environ["ENV"] = "test"
os.environ["YT_API_KEY"] = "test-key"
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from backend.services.yt_search import (
    SearchResult,
    generate_gradient,
    parse_duration,
    normalize_query,
    search_youtube_data_api,
    get_cached_results,
    save_cached_results,
    search_with_cache,
    _in_flight_requests,
)
from backend.models import SearchCache


# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(name="session")
def session_fixture():
    """Create a test database session."""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(autouse=True)
def clear_in_flight():
    """Clear in-flight requests between tests."""
    _in_flight_requests.clear()
    yield
    _in_flight_requests.clear()


# Helper to run async tests without pytest-asyncio
import asyncio

def run_async(coro):
    """Run an async coroutine in sync context."""
    return asyncio.run(coro)


# ============================================================================
# UNIT TESTS FOR HELPER FUNCTIONS
# ============================================================================

def test_generate_gradient():
    """Test deterministic gradient generation from video ID."""
    grad1 = generate_gradient("dQw4w9WgXcQ")
    grad2 = generate_gradient("dQw4w9WgXcQ")
    grad3 = generate_gradient("different_id")
    
    assert grad1 == grad2  # Deterministic
    assert grad1 != grad3  # Different IDs produce different gradients
    assert grad1.startswith("linear-gradient(135deg, hsl(")
    assert "hsl(" in grad1


def test_parse_duration():
    """Test ISO 8601 duration parsing."""
    assert parse_duration("PT4M13S") == 253
    assert parse_duration("PT3M") == 180
    assert parse_duration("PT45S") == 45
    assert parse_duration("PT1H2M3S") == 3723
    assert parse_duration("") == 0
    assert parse_duration("invalid") == 0


def test_normalize_query():
    """Test query normalization for caching."""
    assert normalize_query("  Hello World  ") == "hello world"
    assert normalize_query("TEST") == "test"
    assert normalize_query("  ") == ""


# ============================================================================
# TESTS FOR search_youtube_data_api (MOCKED)
# ============================================================================

def test_search_youtube_data_api_success():
    """Test successful YouTube API search with mocked response."""
    mock_search_response = {
        "items": [
            {
                "id": {"videoId": "dQw4w9WgXcQ"},
                "snippet": {
                    "title": "Never Gonna Give You Up",
                    "channelTitle": "Rick Astley",
                    "thumbnails": {
                        "high": {"url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"}
                    }
                }
            },
            {
                "id": {"videoId": "9bZkp7q19f0"},
                "snippet": {
                    "title": "Gangnam Style",
                    "channelTitle": "PSY",
                    "thumbnails": {
                        "high": {"url": "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg"}
                    }
                }
            }
        ]
    }
    
    mock_details_response = {"items": [
        {"id": "dQw4w9WgXcQ", "contentDetails": {"duration": "PT3M32S"}, "snippet": {"thumbnails": {"maxres": {"url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"}}}},
        {"id": "9bZkp7q19f0", "contentDetails": {"duration": "PT4M12S"}, "snippet": {"thumbnails": {"maxres": {"url": "https://i.ytimg.com/vi/9bZkp7q19f0/maxresdefault.jpg"}}}},
    ]}
    
    with patch("backend.services.yt_search.settings.YT_API_KEY", "test-key"), \
         patch("backend.services.yt_search.check_quota", return_value=True), \
         patch("httpx.AsyncClient.get") as mock_get:
        
        # First call for search, second for video details
        mock_search_resp = MagicMock()
        mock_search_resp.json.return_value = mock_search_response
        mock_search_resp.raise_for_status = MagicMock()
        
        mock_details_resp = MagicMock()
        mock_details_resp.json.return_value = mock_details_response
        mock_details_resp.raise_for_status = MagicMock()
        
        mock_get.side_effect = [mock_search_resp, mock_details_resp]
        
        results = run_async(search_youtube_data_api("rick astley", limit=20))
        
        assert len(results) == 2
        assert results[0].yt_id == "dQw4w9WgXcQ"
        assert results[0].title == "Never Gonna Give You Up"
        assert results[0].artist == "Rick Astley"
        assert results[0].duration == 212
        # The code uses search response thumbnail (high quality) first
        assert results[0].thumbnail == "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
        assert results[0].grad.startswith("linear-gradient(135deg, hsl(")
        
        assert results[1].yt_id == "9bZkp7q19f0"
        assert results[1].title == "Gangnam Style"
        assert results[1].artist == "PSY"
        assert results[1].duration == 252


def test_search_youtube_data_api_no_api_key():
    """Test search returns empty when API key not configured."""
    with patch("backend.services.yt_search.settings.YT_API_KEY", None):
        results = run_async(search_youtube_data_api("test query"))
        assert results == []


def test_search_youtube_data_api_quota_exceeded():
    """Test search returns empty when quota exceeded."""
    with patch("backend.services.yt_search.settings.YT_API_KEY", "test-key"), \
         patch("backend.services.yt_search.check_quota", return_value=False):
        results = run_async(search_youtube_data_api("test query"))
        assert results == []


def test_search_youtube_data_api_http_error():
    """Test search handles HTTP errors gracefully."""
    import httpx
    
    with patch("backend.services.yt_search.settings.YT_API_KEY", "test-key"), \
         patch("backend.services.yt_search.check_quota", return_value=True), \
         patch("httpx.AsyncClient.get") as mock_get:
        
        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "403 Forbidden", request=MagicMock(), response=MagicMock(status_code=403)
        )
        mock_resp.text = "quota exceeded"
        mock_get.return_value = mock_resp
        
        results = run_async(search_youtube_data_api("test query"))
        assert results == []


def test_search_youtube_data_api_empty_results():
    """Test search handles empty results."""
    mock_search_response = {"items": []}
    
    with patch("backend.services.yt_search.settings.YT_API_KEY", "test-key"), \
         patch("backend.services.yt_search.check_quota", return_value=True), \
         patch("httpx.AsyncClient.get") as mock_get:
        
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_search_response
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp
        
        results = run_async(search_youtube_data_api("nonexistent query xyz123"))
        assert results == []


# ============================================================================
# TESTS FOR CACHE OPERATIONS
# ============================================================================

def test_save_and_get_cached_results(session: Session):
    """Test saving and retrieving cached results."""
    results = [
        SearchResult(
            yt_id="dQw4w9WgXcQ",
            title="Never Gonna Give You Up",
            artist="Rick Astley",
            duration=212,
            thumbnail="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            grad="linear-gradient(135deg, hsl(200, 80%, 25%), hsl(245, 80%, 40%))",
        )
    ]
    
    run_async(save_cached_results(session, "rick astley", results))
    
    cached = run_async(get_cached_results(session, "rick astley"))
    assert cached is not None
    assert len(cached) == 1
    assert cached[0].yt_id == "dQw4w9WgXcQ"
    assert cached[0].title == "Never Gonna Give You Up"
    assert cached[0].artist == "Rick Astley"


def test_get_cached_results_expired(session: Session):
    """Test that expired cache returns None."""
    # Create expired cache entry
    expired_entry = SearchCache(
        key="expired query",
        payload={"results": [{
            "yt_id": "test123",
            "title": "Test",
            "artist": "Artist",
            "duration": 100,
            "thumbnail": "",
            "grad": "linear-gradient(135deg, hsl(0, 80%, 25%), hsl(45, 80%, 40%))",
        }]},
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    session.add(expired_entry)
    session.commit()
    
    cached = run_async(get_cached_results(session, "expired query"))
    assert cached is None


def test_get_cached_results_case_insensitive(session: Session):
    """Test cache lookup is case-insensitive."""
    results = [
        SearchResult(
            yt_id="test123",
            title="Test Song",
            artist="Test Artist",
            duration=100,
            thumbnail="",
            grad="linear-gradient(135deg, hsl(0, 80%, 25%), hsl(45, 80%, 40%))",
        )
    ]
    
    run_async(save_cached_results(session, "Test Query", results))
    
    # Should find with different case
    cached = run_async(get_cached_results(session, "test query"))
    assert cached is not None
    assert len(cached) == 1
    
    cached = run_async(get_cached_results(session, "TEST QUERY"))
    assert cached is not None
    assert len(cached) == 1


# ============================================================================
# TESTS FOR search_with_cache (INTEGRATION)
# ============================================================================

def test_search_with_cache_fresh_hit(session: Session):
    """Test search returns fresh cache hit without calling API."""
    # Pre-populate cache
    results = [
        SearchResult(
            yt_id="cached123",
            title="Cached Song",
            artist="Cached Artist",
            duration=180,
            thumbnail="https://example.com/thumb.jpg",
            grad="linear-gradient(135deg, hsl(100, 80%, 25%), hsl(145, 80%, 40%))",
        )
    ]
    run_async(save_cached_results(session, "cached query", results))
    
    # Mock API to ensure it's NOT called
    with patch("backend.services.yt_search.search_youtube_data_api", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = []  # Would return empty if called
        
        found_results, from_cache, is_stale = run_async(search_with_cache(session, "cached query"))
        
        assert from_cache is True
        assert is_stale is False
        assert len(found_results) == 1
        assert found_results[0].yt_id == "cached123"
        mock_api.assert_not_called()


def test_search_with_cache_api_success(session: Session):
    """Test search calls API and caches results when no cache exists."""
    mock_api_results = [
        SearchResult(
            yt_id="api123",
            title="API Song",
            artist="API Artist",
            duration=200,
            thumbnail="https://example.com/api.jpg",
            grad="linear-gradient(135deg, hsl(50, 80%, 25%), hsl(95, 80%, 40%))",
        )
    ]
    
    with patch("backend.services.yt_search.search_youtube_data_api", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = mock_api_results
        
        found_results, from_cache, is_stale = run_async(search_with_cache(session, "new query"))
        
        assert from_cache is False
        assert is_stale is False
        assert len(found_results) == 1
        assert found_results[0].yt_id == "api123"
        mock_api.assert_called_once()
        
        # Verify it was cached
        cached = run_async(get_cached_results(session, "new query"))
        assert cached is not None
        assert cached[0].yt_id == "api123"


def test_search_with_cache_api_failure_stale_fallback(session: Session):
    """Test search falls back to stale cache when API fails."""
    # Create stale cache entry (expired)
    stale_entry = SearchCache(
        key="stale query",
        payload={"results": [{
            "yt_id": "stale123",
            "title": "Stale Song",
            "artist": "Stale Artist",
            "duration": 150,
            "thumbnail": "",
            "grad": "linear-gradient(135deg, hsl(200, 80%, 25%), hsl(245, 80%, 40%))",
        }]},
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    session.add(stale_entry)
    session.commit()
    
    with patch("backend.services.yt_search.search_youtube_data_api", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = []  # API returns no results (simulating failure)
        
        found_results, from_cache, is_stale = run_async(search_with_cache(session, "stale query"))
        
        assert from_cache is True
        assert is_stale is True
        assert len(found_results) == 1
        assert found_results[0].yt_id == "stale123"
        assert found_results[0].title == "Stale Song"


def test_search_with_cache_api_failure_no_stale(session: Session):
    """Test search returns empty when API fails and no stale cache."""
    with patch("backend.services.yt_search.search_youtube_data_api", new_callable=AsyncMock) as mock_api:
        mock_api.return_value = []
        
        found_results, from_cache, is_stale = run_async(search_with_cache(session, "brand new query"))
        
        assert from_cache is False
        assert is_stale is False
        assert found_results == []


def test_search_with_cache_deduplicates_in_flight(session: Session):
    """Test that concurrent same-query requests are deduplicated."""
    call_count = 0
    
    async def mock_api_func(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.01)  # Simulate network delay
        return [
            SearchResult(
                yt_id=f"result{call_count}",
                title=f"Song {call_count}",
                artist="Artist",
                duration=100,
                thumbnail="",
                grad="linear-gradient(135deg, hsl(0, 80%, 25%), hsl(45, 80%, 40%))",
            )
        ]
    
    # Use a regular Mock with side_effect returning a coroutine
    with patch("backend.services.yt_search.search_youtube_data_api") as mock_api:
        mock_api.side_effect = mock_api_func
        
        # Fire multiple concurrent requests for the same query
        async def run_concurrent():
            tasks = [
                search_with_cache(session, "concurrent query"),
                search_with_cache(session, "concurrent query"),
                search_with_cache(session, "concurrent query"),
            ]
            return await asyncio.gather(*tasks)
        
        results = run_async(run_concurrent())
        
        # API should only be called once
        assert call_count == 1
        # All three should get the same result
        assert all(r[0][0].yt_id == "result1" for r in results)


# ============================================================================
# TESTS FOR SEARCH ENDPOINT
# ============================================================================

from fastapi.testclient import TestClient
from backend.main import app
from backend.db import get_session
from backend.config import settings


@pytest.fixture(name="client")
def client_fixture():
    """Create a test client with overridden database session."""
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    
    def get_session_override():
        with Session(engine) as session:
            yield session
    
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_search_endpoint_success(client: TestClient):
    """Test search endpoint returns results."""
    mock_results = [
        SearchResult(
            yt_id="endpoint123",
            title="Endpoint Song",
            artist="Endpoint Artist",
            duration=180,
            thumbnail="https://example.com/endpoint.jpg",
            grad="linear-gradient(135deg, hsl(120, 80%, 25%), hsl(165, 80%, 40%))",
        )
    ]
    
    # Patch at the module where it's used (main.py imports from services.yt_search)
    with patch("backend.main.search_with_cache", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = (mock_results, False, False)
        
        response = client.get("/api/search?q=test query")
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert len(data["results"]) == 1
        assert data["results"][0]["ytId"] == "endpoint123"
        assert data["results"][0]["title"] == "Endpoint Song"
        assert data["cached"] is False
        assert data["stale"] is False


def test_search_endpoint_cached(client: TestClient):
    """Test search endpoint returns cached results."""
    mock_results = [
        SearchResult(
            yt_id="cached456",
            title="Cached Endpoint Song",
            artist="Cached Endpoint Artist",
            duration=200,
            thumbnail="",
            grad="linear-gradient(135deg, hsl(180, 80%, 25%), hsl(225, 80%, 40%))",
        )
    ]
    
    with patch("backend.main.search_with_cache", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = (mock_results, True, False)
        
        response = client.get("/api/search?q=cached query")
        
        assert response.status_code == 200
        data = response.json()
        assert data["cached"] is True
        assert data["stale"] is False


def test_search_endpoint_stale(client: TestClient):
    """Test search endpoint returns stale results."""
    mock_results = [
        SearchResult(
            yt_id="stale789",
            title="Stale Endpoint Song",
            artist="Stale Endpoint Artist",
            duration=220,
            thumbnail="",
            grad="linear-gradient(135deg, hsl(240, 80%, 25%), hsl(285, 80%, 40%))",
        )
    ]
    
    with patch("backend.main.search_with_cache", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = (mock_results, True, True)
        
        response = client.get("/api/search?q=stale query")
        
        assert response.status_code == 200
        data = response.json()
        assert data["cached"] is True
        assert data["stale"] is True


def test_search_endpoint_invalid_query(client: TestClient):
    """Test search endpoint rejects empty query."""
    response = client.get("/api/search?q=")
    # FastAPI returns 422 for query parameter validation failure
    assert response.status_code in (400, 422)
    if response.status_code == 400:
        assert "required" in response.json()["detail"].lower()


def test_search_endpoint_query_too_long(client: TestClient):
    """Test search endpoint rejects query over 100 chars."""
    long_query = "a" * 101
    response = client.get(f"/api/search?q={long_query}")
    assert response.status_code == 422  # Validation error


def test_search_endpoint_xss_protection(client: TestClient):
    """Test search endpoint - XSS payload in title is returned as-is (frontend escapes)."""
    # The backend returns raw data; frontend uses escapeHtml
    # This test verifies the API doesn't sanitize (that's frontend's job)
    mock_results = [
        SearchResult(
            yt_id="xss123",
            title='<script>alert("xss")</script>',
            artist="XSS Artist",
            duration=100,
            thumbnail="",
            grad="linear-gradient(135deg, hsl(0, 80%, 25%), hsl(45, 80%, 40%))",
        )
    ]
    
    with patch("backend.main.search_with_cache", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = (mock_results, False, False)
        
        response = client.get("/api/search?q=xss test")
        
        assert response.status_code == 200
        data = response.json()
        # Backend returns raw title; frontend must escape
        assert data["results"][0]["title"] == '<script>alert("xss")</script>'


# ============================================================================
# RATE LIMIT TEST
# ============================================================================

def test_search_rate_limit(client: TestClient):
    """Test search rate limit (30/min)."""
    with patch("backend.main.search_with_cache", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = ([], False, False)
        
        # Make requests - should succeed up to limit
        success_count = 0
        for i in range(35):
            response = client.get(f"/api/search?q=query{i}")
            if response.status_code == 200:
                success_count += 1
            elif response.status_code == 429:
                break
        
        # Should have hit rate limit
        assert success_count <= 30
        # Next request should be rate limited
        response = client.get("/api/search?q=final_query")
        assert response.status_code == 429
        assert "rate limit" in response.json()["detail"].lower()


