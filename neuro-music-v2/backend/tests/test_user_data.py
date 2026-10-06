"""Tests for user data API endpoints (playlists, likes, history, settings, home)."""
import os
os.environ["ENV"] = "test"

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from backend.main import app
from backend.db import get_session
from backend.models import User, Playlist, PlaylistTrack, LikedTrack, PlayEvent, UserSettings
from backend.auth import hash_password

# Override database for testing
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


@pytest.fixture(name="client")
def client_fixture(session: Session):
    """Create a test client with overridden database session."""
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="client_b")
def client_b_fixture(session: Session):
    """Create a separate test client with the same session override."""
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_client")
def auth_client_fixture(client: TestClient, session: Session):
    """Create a test client with authenticated user A."""
    # Register user A
    client.post(
        "/api/auth/register",
        json={"email": "usera@example.com", "password": "TestPassword123", "display_name": "User A"},
    )
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "usera@example.com", "password": "TestPassword123"},
    )
    auth_token = login_resp.cookies.get("auth_token")
    client.cookies.set("auth_token", auth_token)
    return client, auth_token


def get_user_id(session: Session, email: str) -> int:
    user = session.query(User).filter(User.email == email).first()
    return user.id


def _create_user_b(session: Session) -> int:
    """Helper to create user B and return their ID."""
    from backend.auth import hash_password
    user_b = User(
        email="userb@example.com",
        hashed_password=hash_password("TestPassword123"),
        display_name="User B",
    )
    session.add(user_b)
    session.commit()
    session.refresh(user_b)
    return user_b.id


# ============================================================================
# PLAYLISTS TESTS
# ============================================================================

def test_create_playlist(auth_client):
    client, _ = auth_client
    response = client.post("/api/playlists", json={"name": "My Playlist", "description": "Test desc"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Playlist"
    assert data["description"] == "Test desc"
    assert data["track_count"] == 0


def test_create_playlist_name_too_long(auth_client):
    client, _ = auth_client
    response = client.post("/api/playlists", json={"name": "x" * 81})
    assert response.status_code == 422


def test_create_playlist_description_too_long(auth_client):
    client, _ = auth_client
    response = client.post("/api/playlists", json={"name": "Test", "description": "x" * 301})
    assert response.status_code == 422


def test_get_playlists_empty(auth_client):
    client, _ = auth_client
    response = client.get("/api/playlists")
    assert response.status_code == 200
    assert response.json() == []


def test_get_playlists_with_data(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    playlist = Playlist(user_id=user_id, name="Playlist 1")
    session.add(playlist)
    session.commit()

    response = client.get("/api/playlists")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Playlist 1"


def test_get_playlist_detail(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    playlist = Playlist(user_id=user_id, name="Detail Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    track = PlaylistTrack(
        playlist_id=playlist.id, yt_id="abc123", title="Test Song", artist="Test Artist", position=0
    )
    session.add(track)
    session.commit()

    response = client.get(f"/api/playlists/{playlist.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Detail Playlist"
    assert len(data["tracks"]) == 1
    assert data["tracks"][0]["title"] == "Test Song"


def test_update_playlist(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    playlist = Playlist(user_id=user_id, name="Old Name")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    response = client.put(f"/api/playlists/{playlist.id}", json={"name": "New Name", "description": "New desc"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Name"
    assert data["description"] == "New desc"


def test_delete_playlist(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    playlist = Playlist(user_id=user_id, name="To Delete")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    response = client.delete(f"/api/playlists/{playlist.id}")
    assert response.status_code == 204

    # Verify deleted
    response = client.get("/api/playlists")
    assert len(response.json()) == 0


def test_playlist_max_limit(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    # Create 100 playlists
    for i in range(100):
        session.add(Playlist(user_id=user_id, name=f"Playlist {i}"))
    session.commit()

    # 101st should fail
    response = client.post("/api/playlists", json={"name": "Playlist 101"})
    assert response.status_code == 400
    assert "Maximum 100 playlists" in response.json()["detail"]


def test_add_track_to_playlist(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    playlist = Playlist(user_id=user_id, name="Test Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    response = client.post(
        f"/api/playlists/{playlist.id}/tracks",
        json={"yt_id": "dQw4w9WgXcQ", "title": "Never Gonna Give You Up", "artist": "Rick Astley", "duration": 212},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["yt_id"] == "dQw4w9WgXcQ"
    assert data["position"] == 0


def test_add_track_to_playlist_max_limit(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    playlist = Playlist(user_id=user_id, name="Test Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    # Add 500 tracks
    for i in range(500):
        session.add(PlaylistTrack(playlist_id=playlist.id, yt_id=f"track{i}", title=f"Song {i}", artist="Artist", position=i))
    session.commit()

    # 501st should fail
    response = client.post(
        f"/api/playlists/{playlist.id}/tracks",
        json={"yt_id": "new", "title": "New", "artist": "Artist"},
    )
    assert response.status_code == 400
    assert "Maximum 500 tracks" in response.json()["detail"]


def test_remove_track_from_playlist(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    playlist = Playlist(user_id=user_id, name="Test Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    track = PlaylistTrack(playlist_id=playlist.id, yt_id="abc", title="Song", artist="Artist", position=0)
    session.add(track)
    session.commit()
    session.refresh(track)

    response = client.delete(f"/api/playlists/{playlist.id}/tracks/{track.id}")
    assert response.status_code == 204


def test_reorder_playlist_tracks(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    playlist = Playlist(user_id=user_id, name="Test Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    track1 = PlaylistTrack(playlist_id=playlist.id, yt_id="t1", title="Song 1", artist="Artist", position=0)
    track2 = PlaylistTrack(playlist_id=playlist.id, yt_id="t2", title="Song 2", artist="Artist", position=1)
    track3 = PlaylistTrack(playlist_id=playlist.id, yt_id="t3", title="Song 3", artist="Artist", position=2)
    session.add_all([track1, track2, track3])
    session.commit()
    session.refresh(track1)
    session.refresh(track2)
    session.refresh(track3)

    # Reorder: 3, 1, 2
    response = client.put(
        f"/api/playlists/{playlist.id}/tracks/reorder",
        json={"track_ids": [track3.id, track1.id, track2.id]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data[0]["id"] == track3.id
    assert data[0]["position"] == 0
    assert data[1]["id"] == track1.id
    assert data[1]["position"] == 1
    assert data[2]["id"] == track2.id
    assert data[2]["position"] == 2


# ============================================================================
# PLAYLIST PERMISSION TESTS (User A cannot access User B's data)
# ============================================================================

def test_user_a_cannot_read_user_b_playlist(auth_client, session):
    client_a, _ = auth_client

    # Create user B and their playlist
    user_b_id = _create_user_b(session)
    playlist = Playlist(user_id=user_b_id, name="User B's Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    # User A tries to access
    response = client_a.get(f"/api/playlists/{playlist.id}")
    assert response.status_code == 404


def test_user_a_cannot_update_user_b_playlist(auth_client, session):
    client_a, _ = auth_client

    user_b_id = _create_user_b(session)
    playlist = Playlist(user_id=user_b_id, name="User B's Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    response = client_a.put(f"/api/playlists/{playlist.id}", json={"name": "Hacked"})
    assert response.status_code == 404


def test_user_a_cannot_delete_user_b_playlist(auth_client, session):
    client_a, _ = auth_client

    user_b_id = _create_user_b(session)
    playlist = Playlist(user_id=user_b_id, name="User B's Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    response = client_a.delete(f"/api/playlists/{playlist.id}")
    assert response.status_code == 404


def test_user_a_cannot_add_track_to_user_b_playlist(auth_client, session):
    client_a, _ = auth_client

    user_b_id = _create_user_b(session)
    playlist = Playlist(user_id=user_b_id, name="User B's Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    response = client_a.post(
        f"/api/playlists/{playlist.id}/tracks",
        json={"yt_id": "hack", "title": "Hack", "artist": "Hacker"},
    )
    assert response.status_code == 404


def test_user_a_cannot_remove_track_from_user_b_playlist(auth_client, session):
    client_a, _ = auth_client

    user_b_id = _create_user_b(session)
    playlist = Playlist(user_id=user_b_id, name="User B's Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    track = PlaylistTrack(playlist_id=playlist.id, yt_id="abc", title="Song", artist="Artist", position=0)
    session.add(track)
    session.commit()
    session.refresh(track)

    response = client_a.delete(f"/api/playlists/{playlist.id}/tracks/{track.id}")
    assert response.status_code == 404


def test_user_a_cannot_reorder_user_b_playlist(auth_client, session):
    client_a, _ = auth_client

    user_b_id = _create_user_b(session)
    playlist = Playlist(user_id=user_b_id, name="User B's Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    track = PlaylistTrack(playlist_id=playlist.id, yt_id="abc", title="Song", artist="Artist", position=0)
    session.add(track)
    session.commit()
    session.refresh(track)

    response = client_a.put(
        f"/api/playlists/{playlist.id}/tracks/reorder",
        json={"track_ids": [track.id]},
    )
    assert response.status_code == 404


# ============================================================================
# LIKES TESTS
# ============================================================================

def test_get_likes_empty(auth_client):
    client, _ = auth_client
    response = client.get("/api/likes")
    assert response.status_code == 200
    assert response.json() == []


def test_add_like(auth_client):
    client, _ = auth_client
    response = client.post(
        "/api/likes",
        json={"yt_id": "dQw4w9WgXcQ", "title": "Never Gonna Give You Up", "artist": "Rick Astley"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["yt_id"] == "dQw4w9WgXcQ"
    assert data["title"] == "Never Gonna Give You Up"


def test_add_like_idempotent(auth_client):
    client, _ = auth_client
    # Like once
    client.post("/api/likes", json={"yt_id": "abc", "title": "Song", "artist": "Artist"})
    # Like again
    response = client.post("/api/likes", json={"yt_id": "abc", "title": "Song", "artist": "Artist"})
    assert response.status_code == 201
    data = response.json()
    assert data["yt_id"] == "abc"


def test_remove_like(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    liked = LikedTrack(user_id=user_id, yt_id="abc", title="Song", artist="Artist")
    session.add(liked)
    session.commit()

    response = client.delete("/api/likes/abc")
    assert response.status_code == 204


def test_remove_like_not_found(auth_client):
    client, _ = auth_client
    response = client.delete("/api/likes/nonexistent")
    assert response.status_code == 404


def test_get_likes_sort_recent(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    now = datetime.now(timezone.utc)
    session.add_all([
        LikedTrack(user_id=user_id, yt_id="1", title="A", artist="Artist", created_at=now),
        LikedTrack(user_id=user_id, yt_id="2", title="B", artist="Artist", created_at=now),
        LikedTrack(user_id=user_id, yt_id="3", title="C", artist="Artist", created_at=now),
    ])
    session.commit()

    response = client.get("/api/likes?sort=recent")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


def test_get_likes_sort_title(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    session.add_all([
        LikedTrack(user_id=user_id, yt_id="1", title="C Song", artist="Artist"),
        LikedTrack(user_id=user_id, yt_id="2", title="A Song", artist="Artist"),
        LikedTrack(user_id=user_id, yt_id="3", title="B Song", artist="Artist"),
    ])
    session.commit()

    response = client.get("/api/likes?sort=title")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["title"] == "A Song"
    assert data[1]["title"] == "B Song"
    assert data[2]["title"] == "C Song"


def test_get_likes_sort_artist(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    session.add_all([
        LikedTrack(user_id=user_id, yt_id="1", title="Song", artist="C Artist"),
        LikedTrack(user_id=user_id, yt_id="2", title="Song", artist="A Artist"),
        LikedTrack(user_id=user_id, yt_id="3", title="Song", artist="B Artist"),
    ])
    session.commit()

    response = client.get("/api/likes?sort=artist")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["artist"] == "A Artist"
    assert data[1]["artist"] == "B Artist"
    assert data[2]["artist"] == "C Artist"


def test_user_a_cannot_see_user_b_likes(auth_client, session):
    client_a, _ = auth_client

    user_b_id = _create_user_b(session)
    session.add(LikedTrack(user_id=user_b_id, yt_id="secret", title="Secret", artist="Artist"))
    session.commit()

    response = client_a.get("/api/likes")
    assert response.status_code == 200
    assert len(response.json()) == 0


# ============================================================================
# HISTORY TESTS
# ============================================================================

def test_add_history(auth_client):
    client, _ = auth_client
    response = client.post(
        "/api/history",
        json={"yt_id": "dQw4w9WgXcQ", "title": "Never Gonna Give You Up", "artist": "Rick Astley"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["yt_id"] == "dQw4w9WgXcQ"


def test_add_history_disabled_by_setting(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    settings = UserSettings(user_id=user_id, data={"use_listening_history": False})
    session.add(settings)
    session.commit()

    response = client.post(
        "/api/history",
        json={"yt_id": "abc", "title": "Song", "artist": "Artist"},
    )
    assert response.status_code == 403


def test_get_recent_history(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    session.add_all([
        PlayEvent(user_id=user_id, yt_id="1", title="Song 1", artist="Artist", played_at=now - timedelta(days=2)),
        PlayEvent(user_id=user_id, yt_id="2", title="Song 2", artist="Artist", played_at=now - timedelta(days=1)),
    ])
    session.commit()

    response = client.get("/api/history/recent?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["yt_id"] == "2"  # Most recent first


def test_get_top_artists(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    now = datetime.now(timezone.utc)
    session.add_all([
        PlayEvent(user_id=user_id, yt_id="1", title="Song", artist="Artist A", played_at=now),
        PlayEvent(user_id=user_id, yt_id="2", title="Song", artist="Artist A", played_at=now),
        PlayEvent(user_id=user_id, yt_id="3", title="Song", artist="Artist B", played_at=now),
    ])
    session.commit()

    response = client.get("/api/history/top-artists?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert data[0]["artist"] == "Artist A"
    assert data[0]["play_count"] == 2
    assert data[1]["artist"] == "Artist B"
    assert data[1]["play_count"] == 1


# ============================================================================
# SETTINGS TESTS
# ============================================================================

def test_get_settings_defaults(auth_client):
    client, _ = auth_client
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["theme"] == "system"
    assert data["add_playlist_songs_to_library"] is True
    assert data["sound_check"] is False


def test_update_settings(auth_client):
    client, _ = auth_client
    response = client.put(
        "/api/settings",
        json={"theme": "dark", "sound_check": True, "data_saver": True, "high_contrast": True},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["theme"] == "dark"
    assert data["sound_check"] is True
    assert data["data_saver"] is True
    assert data["high_contrast"] is True


def test_update_settings_invalid_theme(auth_client):
    client, _ = auth_client
    response = client.put("/api/settings", json={"theme": "invalid"})
    assert response.status_code == 422


def test_update_settings_invalid_cache_size(auth_client):
    client, _ = auth_client
    response = client.put("/api/settings", json={"cache_size_mb": 5})
    assert response.status_code == 422


def test_settings_persist_after_reload(auth_client, session):
    client, auth_token = auth_client
    client.put("/api/settings", json={"theme": "light", "high_contrast": True})

    # Simulate new request (same client, same session, same cookie)
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["theme"] == "light"
    assert data["high_contrast"] is True


# ============================================================================
# HOME TESTS
# ============================================================================

def test_home_new_user(auth_client):
    client, _ = auth_client
    response = client.get("/api/home")
    assert response.status_code == 200
    data = response.json()
    assert "listen_again" in data
    assert "station" in data
    assert "recent" in data
    assert len(data["listen_again"]) == 5  # Default curated
    assert data["station"]["label"] == "Neuro Station"
    assert data["recent"] == []


def test_home_with_history(auth_client, session):
    client, _ = auth_client
    user_id = get_user_id(session, "usera@example.com")
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    session.add_all([
        PlayEvent(user_id=user_id, yt_id="track1", title="Song 1", artist="Artist A", played_at=now - timedelta(days=2)),
        PlayEvent(user_id=user_id, yt_id="track2", title="Song 2", artist="Artist A", played_at=now - timedelta(days=1)),
        PlayEvent(user_id=user_id, yt_id="track3", title="Song 3", artist="Artist B", played_at=now),
    ])
    session.commit()

    response = client.get("/api/home")
    assert response.status_code == 200
    data = response.json()
    assert len(data["recent"]) == 3
    assert len(data["listen_again"]) > 0
    assert data["station"]["label"] == "Neuro Station"


# ============================================================================
# UNAUTHENTICATED ACCESS TESTS
# ============================================================================

def test_unauthenticated_playlists(client):
    response = client.get("/api/playlists")
    assert response.status_code == 401


def test_unauthenticated_likes(client):
    response = client.get("/api/likes")
    assert response.status_code == 401


def test_unauthenticated_history(client):
    response = client.get("/api/history/recent")
    assert response.status_code == 401


def test_unauthenticated_settings(client):
    response = client.get("/api/settings")
    assert response.status_code == 401


def test_unauthenticated_home(client):
    response = client.get("/api/home")
    assert response.status_code == 401