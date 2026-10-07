"""SQLModel database models for Neuro Music."""
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, Integer, String, Text
from sqlmodel import (
    Column,
    DateTime,
    Field,
    Index,
    Relationship,
    SQLModel,
    UniqueConstraint,
)


def utc_now() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    """User account model."""
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(
        sa_column=Column(
            Text,
            unique=True,
            index=True,
            nullable=False,
        )
    )
    hashed_password: str = Field(sa_column=Column(Text, nullable=False))
    display_name: str = Field(default="", sa_column=Column(Text, nullable=False))
    avatar_url: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    country: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=utc_now),
    )

    # Relationships
    sessions: list["Session"] = Relationship(back_populates="user")
    settings: Optional["UserSettings"] = Relationship(back_populates="user")
    playlists: list["Playlist"] = Relationship(back_populates="user")
    liked_tracks: list["LikedTrack"] = Relationship(back_populates="user")
    play_events: list["PlayEvent"] = Relationship(back_populates="user")
    password_reset_tokens: list["PasswordResetToken"] = Relationship(back_populates="user")


class Session(SQLModel, table=True):
    """User session (refresh token) model."""
    __tablename__ = "sessions"

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        sa_column=Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4())),
    )
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    device: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    ip: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=utc_now),
    )
    last_used_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=utc_now),
    )
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    revoked: bool = Field(default=False, sa_column=Column("revoked", Boolean, nullable=False, default=False))

    # Relationships
    user: User = Relationship(back_populates="sessions")


class UserSettings(SQLModel, table=True):
    """User settings stored as JSON."""
    __tablename__ = "user_settings"

    user_id: int = Field(foreign_key="users.id", primary_key=True)
    data: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now),
    )

    # Relationships
    user: User = Relationship(back_populates="settings")


class Playlist(SQLModel, table=True):
    """User playlist model."""
    __tablename__ = "playlists"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    name: str = Field(sa_column=Column(Text, nullable=False))
    description: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=utc_now),
    )

    # Relationships
    user: User = Relationship(back_populates="playlists")
    tracks: list["PlaylistTrack"] = Relationship(
        back_populates="playlist",
        sa_relationship_kwargs={"order_by": "PlaylistTrack.position"},
    )


class PlaylistTrack(SQLModel, table=True):
    """Track within a playlist."""
    __tablename__ = "playlist_tracks"

    id: int | None = Field(default=None, primary_key=True)
    playlist_id: int = Field(foreign_key="playlists.id", nullable=False, index=True)
    yt_id: str = Field(sa_column=Column(Text, nullable=False, index=True))
    title: str = Field(sa_column=Column(Text, nullable=False))
    artist: str = Field(sa_column=Column(Text, nullable=False))
    album: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    duration: int | None = Field(default=None, sa_column=Column(Integer, nullable=True))
    position: int = Field(default=0, sa_column=Column(Integer, nullable=False, default=0))

    # Relationships
    playlist: Playlist = Relationship(back_populates="tracks")


class LikedTrack(SQLModel, table=True):
    """User liked track."""
    __tablename__ = "liked_tracks"
    __table_args__ = (
        UniqueConstraint("user_id", "yt_id", name="uq_user_yt_id"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    yt_id: str = Field(sa_column=Column(Text, nullable=False, index=True))
    title: str = Field(sa_column=Column(Text, nullable=False))
    artist: str = Field(sa_column=Column(Text, nullable=False))
    album: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    duration: int | None = Field(default=None, sa_column=Column(Integer, nullable=True))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=utc_now),
    )

    # Relationships
    user: User = Relationship(back_populates="liked_tracks")


class PlayEvent(SQLModel, table=True):
    """Play history event for analytics/recommendations."""
    __tablename__ = "play_events"
    __table_args__ = (
        Index("ix_play_events_user_played_at", "user_id", "played_at"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    yt_id: str = Field(sa_column=Column(Text, nullable=False, index=True))
    title: str = Field(sa_column=Column(Text, nullable=False))
    artist: str = Field(sa_column=Column(Text, nullable=False))
    played_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=utc_now, index=True),
    )

    # Relationships
    user: User = Relationship(back_populates="play_events")


class SearchCache(SQLModel, table=True):
    """Cached search results from YouTube Music."""
    __tablename__ = "search_cache"

    key: str = Field(sa_column=Column(Text, primary_key=True, nullable=False))
    payload: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=utc_now),
    )
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, index=True))


class PasswordResetToken(SQLModel, table=True):
    """Password reset token (hashed)."""
    __tablename__ = "password_reset_tokens"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    token_hash: str = Field(sa_column=Column(Text, nullable=False))
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    used: bool = Field(default=False, sa_column=Column(Boolean, nullable=False, default=False))
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=utc_now),
    )

    # Relationships
    user: User = Relationship(back_populates="password_reset_tokens")