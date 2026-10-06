"""Tests for database models."""
import os
os.environ["ENV"] = "test"

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from backend.models import User, UserSettings, Playlist, PlaylistTrack, LikedTrack, PlayEvent
from backend.config import settings


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


def test_create_user(session: Session):
    """Test creating and reading a user."""
    user = User(
        email="test@example.com",
        hashed_password="hashed_password_here",
        display_name="Test User",
        avatar_url="https://example.com/avatar.png",
        country="US",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    assert user.id is not None
    assert user.email == "test@example.com"
    assert user.hashed_password == "hashed_password_here"
    assert user.display_name == "Test User"
    assert user.avatar_url == "https://example.com/avatar.png"
    assert user.country == "US"
    assert user.created_at is not None


def test_user_email_unique(session: Session):
    """Test that user email must be unique."""
    user1 = User(
        email="test@example.com",
        hashed_password="hash1",
        display_name="User 1",
    )
    user2 = User(
        email="test@example.com",
        hashed_password="hash2",
        display_name="User 2",
    )
    session.add(user1)
    session.commit()

    session.add(user2)
    with pytest.raises(Exception):  # IntegrityError
        session.commit()


def test_user_settings(session: Session):
    """Test user settings JSON column."""
    user = User(
        email="settings@example.com",
        hashed_password="hash",
        display_name="Settings User",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    user_settings = UserSettings(
        user_id=user.id,
        data={"theme": "dark", "language": "en", "notifications": True},
    )
    session.add(user_settings)
    session.commit()
    session.refresh(user_settings)

    assert user_settings.user_id == user.id
    assert user_settings.data["theme"] == "dark"
    assert user_settings.data["language"] == "en"
    assert user_settings.data["notifications"] is True
    assert user_settings.updated_at is not None


def test_playlist_and_tracks(session: Session):
    """Test creating a playlist with tracks."""
    user = User(
        email="playlist@example.com",
        hashed_password="hash",
        display_name="Playlist User",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    playlist = Playlist(
        user_id=user.id,
        name="My Favorites",
        description="My favorite tracks",
    )
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    assert playlist.id is not None
    assert playlist.name == "My Favorites"

    track1 = PlaylistTrack(
        playlist_id=playlist.id,
        yt_id="dQw4w9WgXcQ",
        title="Never Gonna Give You Up",
        artist="Rick Astley",
        album="Whenever You Need Somebody",
        duration=212,
        position=0,
    )
    track2 = PlaylistTrack(
        playlist_id=playlist.id,
        yt_id="9bZkp7q19f0",
        title="Gangnam Style",
        artist="PSY",
        album="Psy 6 (Six Rules), Part 1",
        duration=252,
        position=1,
    )
    session.add(track1)
    session.add(track2)
    session.commit()

    # Verify tracks are associated with playlist
    tracks = session.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == playlist.id).all()
    assert len(tracks) == 2
    assert tracks[0].position == 0
    assert tracks[1].position == 1


def test_liked_tracks_unique_constraint(session: Session):
    """Test that a user can only like a track once."""
    user = User(
        email="like@example.com",
        hashed_password="hash",
        display_name="Like User",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    liked1 = LikedTrack(
        user_id=user.id,
        yt_id="dQw4w9WgXcQ",
        title="Never Gonna Give You Up",
        artist="Rick Astley",
        album="Whenever You Need Somebody",
        duration=212,
    )
    session.add(liked1)
    session.commit()

    # Try to like the same track again
    liked2 = LikedTrack(
        user_id=user.id,
        yt_id="dQw4w9WgXcQ",
        title="Never Gonna Give You Up",
        artist="Rick Astley",
        album="Whenever You Need Somebody",
        duration=212,
    )
    session.add(liked2)
    with pytest.raises(Exception):  # IntegrityError
        session.commit()


def test_play_events(session: Session):
    """Test recording play events."""
    user = User(
        email="play@example.com",
        hashed_password="hash",
        display_name="Play User",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    event = PlayEvent(
        user_id=user.id,
        yt_id="dQw4w9WgXcQ",
        title="Never Gonna Give You Up",
        artist="Rick Astley",
    )
    session.add(event)
    session.commit()
    session.refresh(event)

    assert event.id is not None
    assert event.user_id == user.id
    assert event.yt_id == "dQw4w9WgXcQ"
    assert event.title == "Never Gonna Give You Up"
    assert event.artist == "Rick Astley"
    assert event.played_at is not None


def test_user_relationships(session: Session):
    """Test that relationships work correctly."""
    user = User(
        email="rel@example.com",
        hashed_password="hash",
        display_name="Relationship User",
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    # Create playlist
    playlist = Playlist(user_id=user.id, name="Test Playlist")
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    # Create liked track
    liked = LikedTrack(
        user_id=user.id,
        yt_id="test123",
        title="Test Song",
        artist="Test Artist",
    )
    session.add(liked)
    session.commit()

    # Create play event
    event = PlayEvent(
        user_id=user.id,
        yt_id="test123",
        title="Test Song",
        artist="Test Artist",
    )
    session.add(event)
    session.commit()

    # Refresh user and check relationships
    session.refresh(user)
    assert len(user.playlists) == 1
    assert user.playlists[0].name == "Test Playlist"
    assert len(user.liked_tracks) == 1
    assert user.liked_tracks[0].yt_id == "test123"
    assert len(user.play_events) == 1
    assert user.play_events[0].yt_id == "test123"