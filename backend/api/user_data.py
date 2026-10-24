"""
API routes for user data: playlists, likes, history, settings, home.
All endpoints require authentication via get_current_user.
"""
import logging
from datetime import datetime, timezone

from backend.auth import get_current_user
from backend.db import get_session
from backend.models import (
    LikedTrack,
    PlayEvent,
    Playlist,
    PlaylistTrack,
    User,
    UserSettings,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import desc, func, select
from sqlmodel import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["user-data"])


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class PlaylistBase(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=300)


class PlaylistCreate(PlaylistBase):
    pass


class PlaylistUpdate(PlaylistBase):
    pass


class PlaylistTrackAdd(BaseModel):
    yt_id: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=200)
    artist: str = Field(min_length=1, max_length=200)
    album: str | None = Field(default=None, max_length=200)
    duration: int | None = Field(default=None, ge=0)


class PlaylistReorder(BaseModel):
    track_ids: list[int] = Field(min_length=1)


class PlaylistResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    track_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class PlaylistDetailResponse(PlaylistResponse):
    tracks: list["PlaylistTrackResponse"] = []


class PlaylistTrackResponse(BaseModel):
    id: int
    yt_id: str
    title: str
    artist: str
    album: str | None = None
    duration: int | None = None
    position: int

    class Config:
        from_attributes = True


class LikedTrackResponse(BaseModel):
    id: int
    yt_id: str
    title: str
    artist: str
    album: str | None = None
    duration: int | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class LikeRequest(BaseModel):
    yt_id: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=200)
    artist: str = Field(min_length=1, max_length=200)
    album: str | None = Field(default=None, max_length=200)
    duration: int | None = Field(default=None, ge=0)


class HistoryRequest(BaseModel):
    yt_id: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=200)
    artist: str = Field(min_length=1, max_length=200)


class PlayEventResponse(BaseModel):
    id: int
    yt_id: str
    title: str
    artist: str
    played_at: datetime

    class Config:
        from_attributes = True


class TopArtistResponse(BaseModel):
    artist: str
    play_count: int


class SettingsSchema(BaseModel):
    """Validated settings schema - only known keys allowed."""
    # Library
    add_playlist_songs_to_library: bool = True
    add_liked_songs_to_library: bool = True
    # Playback
    sound_check: bool = False
    # Data
    data_saver: bool = False
    use_listening_history: bool = True
    cache_size_mb: int = Field(default=100, ge=10, le=500)
    # Storage
    # (navigator.storage.estimate() is read-only client-side)
    # Display
    theme: str = Field(default="system", pattern="^(system|dark|light)$")
    motion: bool = True
    high_contrast: bool = False
    lyrics_font_size: int = Field(default=17, ge=12, le=24)
    lyrics_auto_scroll: bool = True
    # About
    # (version, privacy, terms, support, feedback are static)

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v: str) -> str:
        if v not in ("system", "dark", "light"):
            raise ValueError("Theme must be 'system', 'dark', or 'light'")
        return v


class HomeResponse(BaseModel):
    listen_again: list[dict]
    station: dict | None = None
    recent: list[dict]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _check_playlist_limits(session: Session, user_id: int) -> None:
    """Check playlist count limit (max 100 per user)."""
    count = session.exec(
        select(func.count(Playlist.id)).where(Playlist.user_id == user_id)
    ).scalar() or 0
    if count >= 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 100 playlists per user"
        )


def _check_track_limits(session: Session, playlist_id: int) -> None:
    """Check track count limit (max 500 per playlist)."""
    count = session.exec(
        select(func.count(PlaylistTrack.id)).where(PlaylistTrack.playlist_id == playlist_id)
    ).scalar() or 0
    if count >= 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 500 tracks per playlist"
        )


def _get_user_playlist(session: Session, user_id: int, playlist_id: int) -> Playlist:
    """Get playlist owned by user, raise 404 if not found."""
    playlist = session.exec(
        select(Playlist).where(
            Playlist.id == playlist_id,
            Playlist.user_id == user_id
        )
    ).scalars().first()
    if not playlist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Playlist not found")
    return playlist


# ============================================================================
# PLAYLISTS ENDPOINTS
# ============================================================================

@router.get("/playlists", response_model=list[PlaylistResponse])
async def get_playlists(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get all playlists for current user."""
    playlists = session.exec(
        select(Playlist)
        .where(Playlist.user_id == current_user.id)
        .order_by(desc(Playlist.created_at))
    ).scalars().all()

    result = []
    for pl in playlists:
        track_count = session.exec(
            select(func.count(PlaylistTrack.id)).where(PlaylistTrack.playlist_id == pl.id)
        ).scalar() or 0
        result.append(PlaylistResponse(
            id=pl.id,
            name=pl.name,
            description=pl.description,
            track_count=track_count,
            created_at=pl.created_at,
        ))
    return result


@router.post("/playlists", response_model=PlaylistResponse, status_code=status.HTTP_201_CREATED)
async def create_playlist(
    data: PlaylistCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Create a new playlist."""
    _check_playlist_limits(session, current_user.id)

    playlist = Playlist(
        user_id=current_user.id,
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
    )
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    logger.info(f"User {current_user.id} created playlist {playlist.id}")
    return PlaylistResponse(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        track_count=0,
        created_at=playlist.created_at,
    )


@router.get("/playlists/{playlist_id}", response_model=PlaylistDetailResponse)
async def get_playlist(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get playlist with tracks."""
    playlist = _get_user_playlist(session, current_user.id, playlist_id)

    tracks = session.exec(
        select(PlaylistTrack)
        .where(PlaylistTrack.playlist_id == playlist_id)
        .order_by(PlaylistTrack.position)
    ).scalars().all()

    track_list = [PlaylistTrackResponse.model_validate(t, from_attributes=True) for t in tracks]

    return PlaylistDetailResponse(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        track_count=len(tracks),
        created_at=playlist.created_at,
        tracks=track_list,
    )


@router.put("/playlists/{playlist_id}", response_model=PlaylistResponse)
async def update_playlist(
    playlist_id: int,
    data: PlaylistUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update playlist name/description."""
    playlist = _get_user_playlist(session, current_user.id, playlist_id)

    playlist.name = data.name.strip()
    playlist.description = data.description.strip() if data.description else None
    session.add(playlist)
    session.commit()
    session.refresh(playlist)

    track_count = session.exec(
        select(func.count(PlaylistTrack.id)).where(PlaylistTrack.playlist_id == playlist_id)
    ).scalar() or 0

    return PlaylistResponse(
        id=playlist.id,
        name=playlist.name,
        description=playlist.description,
        track_count=track_count,
        created_at=playlist.created_at,
    )


@router.delete("/playlists/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Delete a playlist and all its tracks."""
    playlist = _get_user_playlist(session, current_user.id, playlist_id)
    session.delete(playlist)
    session.commit()
    logger.info(f"User {current_user.id} deleted playlist {playlist_id}")


@router.post("/playlists/{playlist_id}/tracks", response_model=PlaylistTrackResponse, status_code=status.HTTP_201_CREATED)
async def add_track_to_playlist(
    playlist_id: int,
    data: PlaylistTrackAdd,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Add a track to a playlist."""
    _get_user_playlist(session, current_user.id, playlist_id)
    _check_track_limits(session, playlist_id)
    
    # Check user settings for adding playlist songs to library
    settings = session.get(UserSettings, current_user.id)
    if settings and settings.data.get("add_playlist_songs_to_library") is False:
        pass  # add_to_library logic handled in frontend

    # Get next position
    max_pos = session.exec(
        select(func.max(PlaylistTrack.position)).where(PlaylistTrack.playlist_id == playlist_id)
    ).scalar()
    next_position = (max_pos or -1) + 1

    track = PlaylistTrack(
        playlist_id=playlist_id,
        yt_id=data.yt_id.strip(),
        title=data.title.strip(),
        artist=data.artist.strip(),
        album=data.album.strip() if data.album else None,
        duration=data.duration,
        position=next_position,
    )
    session.add(track)
    session.commit()
    session.refresh(track)

    return PlaylistTrackResponse.model_validate(track, from_attributes=True)


@router.delete("/playlists/{playlist_id}/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_track_from_playlist(
    playlist_id: int,
    track_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Remove a track from a playlist."""
    _get_user_playlist(session, current_user.id, playlist_id)  # Verify ownership

    track = session.get(PlaylistTrack, track_id)
    if not track or track.playlist_id != playlist_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Track not found in playlist")

    session.delete(track)
    session.commit()


@router.put("/playlists/{playlist_id}/tracks/reorder", response_model=list[PlaylistTrackResponse])
async def reorder_playlist_tracks(
    playlist_id: int,
    data: PlaylistReorder,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Reorder tracks in a playlist."""
    _get_user_playlist(session, current_user.id, playlist_id)  # Verify ownership

    # Verify all track IDs belong to this playlist
    tracks = session.exec(
        select(PlaylistTrack).where(
            PlaylistTrack.playlist_id == playlist_id,
            PlaylistTrack.id.in_(data.track_ids)
        )
    ).scalars().all()

    if len(tracks) != len(data.track_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid track IDs")

    # Update positions
    track_map = {t.id: t for t in tracks}
    for new_pos, track_id in enumerate(data.track_ids):
        track = track_map[track_id]
        track.position = new_pos
        session.add(track)

    session.commit()

    # Return reordered tracks
    updated = session.exec(
        select(PlaylistTrack)
        .where(PlaylistTrack.playlist_id == playlist_id)
        .order_by(PlaylistTrack.position)
    ).scalars().all()

    return [PlaylistTrackResponse.model_validate(t, from_attributes=True) for t in updated]


# ============================================================================
# LIKES ENDPOINTS
# ============================================================================

@router.get("/likes", response_model=list[LikedTrackResponse])
async def get_likes(
    sort: str = Query("recent", pattern="^(recent|title|artist)$"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get liked tracks with sorting options."""
    query = select(LikedTrack).where(LikedTrack.user_id == current_user.id)

    if sort == "recent":
        query = query.order_by(desc(LikedTrack.created_at))
    elif sort == "title":
        query = query.order_by(LikedTrack.title)
    elif sort == "artist":
        query = query.order_by(LikedTrack.artist)

    tracks = session.exec(query).scalars().all()
    return [LikedTrackResponse.model_validate(t, from_attributes=True) for t in tracks]


@router.post("/likes", response_model=LikedTrackResponse, status_code=status.HTTP_201_CREATED)
async def add_like(
    data: LikeRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Like a track (idempotent)."""
    # Check user settings for adding liked songs to library
    settings = session.get(UserSettings, current_user.id)
    if settings and settings.data.get("add_liked_songs_to_library") is False:
        pass  # add_to_library logic handled in frontend
    
    # Check if already liked
    existing = session.exec(
        select(LikedTrack).where(
            LikedTrack.user_id == current_user.id,
            LikedTrack.yt_id == data.yt_id.strip()
        )
    ).scalars().first()

    if existing:
        # Return existing (idempotent)
        return LikedTrackResponse.model_validate(existing, from_attributes=True)

    liked = LikedTrack(
        user_id=current_user.id,
        yt_id=data.yt_id.strip(),
        title=data.title.strip(),
        artist=data.artist.strip(),
        album=data.album.strip() if data.album else None,
        duration=data.duration,
    )
    session.add(liked)
    session.commit()
    session.refresh(liked)

    logger.info(f"User {current_user.id} liked track {data.yt_id}")
    return LikedTrackResponse.model_validate(liked, from_attributes=True)


@router.delete("/likes/{yt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_like(
    yt_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Unlike a track."""
    liked = session.exec(
        select(LikedTrack).where(
            LikedTrack.user_id == current_user.id,
            LikedTrack.yt_id == yt_id.strip()
        )
    ).scalars().first()

    if not liked:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Like not found")

    session.delete(liked)
    session.commit()
    logger.info(f"User {current_user.id} unliked track {yt_id}")


# ============================================================================
# HISTORY ENDPOINTS
# ============================================================================

@router.post("/history", response_model=PlayEventResponse, status_code=status.HTTP_201_CREATED)
async def add_history(
    data: HistoryRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Record a play event (client should debounce)."""
    # Check if user has history enabled
    settings = session.get(UserSettings, current_user.id)
    if settings and settings.data.get("use_listening_history") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Listening history is disabled in settings"
        )

    event = PlayEvent(
        user_id=current_user.id,
        yt_id=data.yt_id.strip(),
        title=data.title.strip(),
        artist=data.artist.strip(),
    )
    session.add(event)
    session.commit()
    session.refresh(event)

    return PlayEventResponse.model_validate(event, from_attributes=True)


@router.get("/history/recent", response_model=list[PlayEventResponse])
async def get_recent_history(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get recent play history."""
    events = session.exec(
        select(PlayEvent)
        .where(PlayEvent.user_id == current_user.id)
        .order_by(desc(PlayEvent.played_at))
        .limit(limit)
    ).scalars().all()

    return [PlayEventResponse.model_validate(e, from_attributes=True) for e in events]


@router.get("/history/top-artists", response_model=list[TopArtistResponse])
async def get_top_artists(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get top artists by play count."""
    results = session.exec(
        select(PlayEvent.artist, func.count(PlayEvent.id).label("play_count"))
        .where(PlayEvent.user_id == current_user.id)
        .group_by(PlayEvent.artist)
        .order_by(desc("play_count"))
        .limit(limit)
    ).all()

    return [TopArtistResponse(artist=artist, play_count=count) for artist, count in results]


# ============================================================================
# SETTINGS ENDPOINTS
# ============================================================================

DEFAULT_SETTINGS = SettingsSchema().model_dump()


@router.get("/settings", response_model=SettingsSchema)
async def get_settings(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Get user settings (with defaults)."""
    user_settings = session.get(UserSettings, current_user.id)
    if not user_settings:
        return SettingsSchema()

    # Merge with defaults to ensure all keys exist
    merged = {**DEFAULT_SETTINGS, **user_settings.data}
    return SettingsSchema(**merged)


@router.put("/settings", response_model=SettingsSchema)
async def update_settings(
    data: SettingsSchema,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Update user settings (validated schema)."""
    user_settings = session.get(UserSettings, current_user.id)
    if not user_settings:
        user_settings = UserSettings(user_id=current_user.id, data={})
        session.add(user_settings)

    user_settings.data = data.model_dump()
    user_settings.updated_at = datetime.now(timezone.utc)
    session.add(user_settings)
    session.commit()
    session.refresh(user_settings)

    return SettingsSchema(**user_settings.data)


# ============================================================================
# HOME ENDPOINT
# ============================================================================

@router.get("/home", response_model=HomeResponse)
async def get_home(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Get curated home data:
    - listen_again: tracks from top artists (or default for new users)
    - station: Neuro Station card
    - recent: recently played tracks
    """
    # Get recent plays for "Listen Again" / "Recently Played"
    recent_events = session.exec(
        select(PlayEvent)
        .where(PlayEvent.user_id == current_user.id)
        .order_by(desc(PlayEvent.played_at))
        .limit(20)
    ).scalars().all()

    # Get top artists for "Listen Again"
    top_artists = session.exec(
        select(PlayEvent.artist, func.count(PlayEvent.id).label("play_count"))
        .where(PlayEvent.user_id == current_user.id)
        .group_by(PlayEvent.artist)
        .order_by(desc("play_count"))
        .limit(10)
    ).all()

    if recent_events:
        # User has history - build from their data
        recent_tracks = []
        seen_yt_ids = set()
        for event in recent_events:
            if event.yt_id not in seen_yt_ids:
                recent_tracks.append({
                    "ytId": event.yt_id,
                    "title": event.title,
                    "artist": event.artist,
                    "thumbnail": f"https://i.ytimg.com/vi/{event.yt_id}/hqdefault.jpg",
                    "grad": f"linear-gradient(135deg, hsl({hash(event.yt_id) % 360}, 80%, 25%), hsl({(hash(event.yt_id) + 45) % 360}, 80%, 40%))",
                })
                seen_yt_ids.add(event.yt_id)

        # Listen Again: pick from top artists
        listen_again = []
        for artist, _ in top_artists[:5]:
            artist_tracks = [t for t in recent_tracks if t["artist"] == artist]
            if artist_tracks:
                listen_again.append(artist_tracks[0])
            if len(listen_again) >= 5:
                break

        station = {
            "label": "Neuro Station",
            "description": f"Based on {top_artists[0][0] if top_artists else 'your taste'}",
            "artists": [a for a, _ in top_artists[:5]],
        }

        return HomeResponse(
            listen_again=listen_again[:5],
            station=station,
            recent=recent_tracks[:10],
        )
    else:
        # New user - curated defaults
        default_listen_again = [
            {
                "ytId": "dQw4w9WgXcQ",
                "title": "Never Gonna Give You Up",
                "artist": "Rick Astley",
                "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
                "grad": "linear-gradient(135deg, hsl(200, 80%, 25%), hsl(245, 80%, 40%))",
            },
            {
                "ytId": "9bZkp7q19f0",
                "title": "Gangnam Style",
                "artist": "PSY",
                "thumbnail": "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg",
                "grad": "linear-gradient(135deg, hsl(30, 80%, 25%), hsl(75, 80%, 40%))",
            },
            {
                "ytId": "kJQP7kiw5Fk",
                "title": "Despacito",
                "artist": "Luis Fonsi ft. Daddy Yankee",
                "thumbnail": "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
                "grad": "linear-gradient(135deg, hsl(15, 80%, 25%), hsl(60, 80%, 40%))",
            },
            {
                "ytId": "YQHsXMglC9A",
                "title": "Shape of You",
                "artist": "Ed Sheeran",
                "thumbnail": "https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg",
                "grad": "linear-gradient(135deg, hsl(340, 80%, 25%), hsl(25, 80%, 40%))",
            },
            {
                "ytId": "JGwWNGJdvx8",
                "title": "Blinding Lights",
                "artist": "The Weeknd",
                "thumbnail": "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
                "grad": "linear-gradient(135deg, hsl(270, 80%, 25%), hsl(315, 80%, 40%))",
            },
        ]

        return HomeResponse(
            listen_again=default_listen_again,
            station={
                "label": "Neuro Station",
                "description": "Discover new music tailored for you",
                "artists": ["Popular Artists"],
            },
            recent=[],
        )


# ============================================================================
# LYRICS ENDPOINT
# ============================================================================

@router.get("/lyrics")
async def get_lyrics(
    title: str = Query(..., min_length=1, max_length=200),
    artist: str = Query(..., min_length=1, max_length=200),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """
    Get lyrics for a track (proxies lrclib.net with caching).
    Returns synced lyrics if available, otherwise plain lyrics.
    """
    from backend.services.lyrics import get_lyrics_with_cache
    
    # Validate input
    if not title.strip() or not artist.strip():
        raise HTTPException(status_code=400, detail="Title and artist are required")
    
    if len(title) > 200 or len(artist) > 200:
        raise HTTPException(status_code=400, detail="Title or artist too long")
    
    result = await get_lyrics_with_cache(session, title.strip(), artist.strip())
    
    if not result:
        return {
            "syncedLyrics": None,
            "plainLyrics": None,
            "instrumental": False,
            "found": False
        }
    
    return {
        "syncedLyrics": result.synced_lyrics,
        "plainLyrics": result.plain_lyrics,
        "instrumental": result.instrumental,
        "found": True
    }


# ============================================================================
# NEW SCREEN ENDPOINT
# ============================================================================

@router.get("/new")
async def get_new_content(
    current_user: User = Depends(get_current_user),
):
    """
    Get editorial content for New screen.
    Returns hero cards and category tiles backed by cached searches.
    """
    # Editorial hero cards (static config, could be from DB in future)
    hero_cards = [
        {
            "id": "hero_1",
            "label": "HOT PLAYLIST",
            "title": "Today's Top Hits",
            "tagline": "The biggest tracks right now",
            "gradient": "linear-gradient(135deg, #ff6b6b, #ee5a5a)",
            "searchQuery": "today top hits 2024"
        },
        {
            "id": "hero_2",
            "label": "NEW ALBUM",
            "title": "Latest Releases",
            "tagline": "Fresh albums this week",
            "gradient": "linear-gradient(135deg, #4ecdc4, #44a08d)",
            "searchQuery": "new album 2024"
        },
        {
            "id": "hero_3",
            "label": "HOT PLAYLIST",
            "title": "Viral on YouTube",
            "tagline": "Trending music videos",
            "gradient": "linear-gradient(135deg, #a8edea, #fed6e3)",
            "searchQuery": "viral songs youtube"
        },
        {
            "id": "hero_4",
            "label": "NEW ALBUM",
            "title": "Emerging Artists",
            "tagline": "Discover new talent",
            "gradient": "linear-gradient(135deg, #ff9a9e, #fecfef)",
            "searchQuery": "emerging artists 2024"
        },
    ]
    
    # Category tiles for curated searches
    categories = [
        {"id": "cat_1", "name": "Bollywood", "query": "bollywood hits 2024", "gradient": "linear-gradient(135deg, #ff6b35, #f7931e)"},
        {"id": "cat_2", "name": "Tamil", "query": "tamil songs 2024", "gradient": "linear-gradient(135deg, #667eea, #764ba2)"},
        {"id": "cat_3", "name": "Pop", "query": "pop music 2024", "gradient": "linear-gradient(135deg, #f093fb, #f5576c)"},
        {"id": "cat_4", "name": "Charts", "query": "billboard hot 100", "gradient": "linear-gradient(135deg, #4facfe, #00f2fe)"},
        {"id": "cat_5", "name": "Concerts", "query": "live concert 2024", "gradient": "linear-gradient(135deg, #fa709a, #fee140)"},
        {"id": "cat_6", "name": "Lofi", "query": "lofi beats chill", "gradient": "linear-gradient(135deg, #a8edea, #fed6e3)"},
        {"id": "cat_7", "name": "Electronic", "query": "electronic music 2024", "gradient": "linear-gradient(135deg, #667eea, #764ba2)"},
        {"id": "cat_8", "name": "Gaming", "query": "gaming music 2024", "gradient": "linear-gradient(135deg, #f093fb, #f5576c)"},
    ]
    
    return {
        "heroCards": hero_cards,
        "categories": categories,
        "bestNewSongsQuery": "best new songs 2024"
    }


# Forward references
PlaylistDetailResponse.model_rebuild()