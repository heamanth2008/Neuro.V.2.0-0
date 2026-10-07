"""Authentication module for Neuro Music."""
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlmodel import Session

from .config import settings
from .db import get_session
from .models import (
    PasswordResetToken,
    User,
    Playlist,
    LikedTrack,
    PlayEvent,
    UserSettings,
    Session as SessionModel,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Common weak passwords (simplified list)
COMMON_PASSWORDS = {
    "password", "12345678", "123456789", "qwerty123", "password123",
    "admin123", "welcome123", "letmein", "monkey", "dragon",
    "sunshine", "iloveyou", "princess", "football", "baseball",
    "abc123", "password1", "1234567", "123123", "qwertyuiop",
}

# In-memory failed login tracking (email -> list of timestamps)
_failed_logins: dict[str, list[float]] = {}

# Security scheme for Bearer token (for API clients)
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash password with bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash (constant-time)."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, session_id: str) -> str:
    """Create JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "sid": session_id,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": session_id,  # JWT ID = session ID
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None


def record_failed_login(email: str) -> None:
    """Record a failed login attempt."""
    now = time.time()
    window_start = now - 15 * 60  # 15 minutes

    if email not in _failed_logins:
        _failed_logins[email] = []

    # Clean old entries
    _failed_logins[email] = [ts for ts in _failed_logins[email] if ts > window_start]
    _failed_logins[email].append(now)


def get_failed_login_count(email: str) -> int:
    """Get failed login count in the last 15 minutes."""
    now = time.time()
    window_start = now - 15 * 60

    if email not in _failed_logins:
        return 0

    _failed_logins[email] = [ts for ts in _failed_logins[email] if ts > window_start]
    return len(_failed_logins[email])


def clear_failed_logins(email: str) -> None:
    """Clear failed login attempts for an email."""
    _failed_logins.pop(email, None)


def set_auth_cookie(response: Response, token: str) -> None:
    """Set the auth cookie with proper flags."""
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path="/",
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the auth cookie."""
    response.delete_cookie(key="auth_token", path="/", secure=settings.is_production, samesite="lax")


def get_token_from_request(request: Request, auth_token: str | None = Cookie(None), authorization: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> str | None:
    """Extract token from cookie or Authorization header."""
    if auth_token:
        return auth_token
    if authorization:
        return authorization.credentials
    return None


async def get_current_user(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    token: str | None = Depends(get_token_from_request),
) -> User:
    """Get current authenticated user from token."""
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_token(token)
    if not payload:
        clear_auth_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id = payload.get("sub")
    session_id = payload.get("sid")

    if not user_id or not session_id:
        clear_auth_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    try:
        user_id_int = int(user_id)
    except ValueError:
        clear_auth_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Get session from database
    db_session = session.get(SessionModel, session_id)
    if not db_session:
        clear_auth_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not found")

    # Check if session is valid
    if db_session.revoked:
        clear_auth_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")

    # Ensure both datetimes are timezone-aware for comparison
    expires_at = db_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        clear_auth_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    # Get user
    user = session.get(User, user_id_int)
    if not user:
        clear_auth_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Update last_used_at
    db_session.last_used_at = datetime.now(timezone.utc)
    session.add(db_session)
    session.commit()

    return user


async def get_optional_user(
    request: Request,
    response: Response,
    session: Session = Depends(get_session),
    token: str | None = Depends(get_token_from_request),
) -> User | None:
    """Get current user if authenticated, otherwise None."""
    if not token:
        return None
    try:
        return await get_current_user(request, response, session, token)
    except HTTPException:
        return None


# --- Pydantic Schemas ---

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=40)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if v.lower() in COMMON_PASSWORDS:
            raise ValueError("Password is too common, please choose a stronger one")
        # Check for at least one letter and one number
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if v.lower() in COMMON_PASSWORDS:
            raise ValueError("Password is too common, please choose a stronger one")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1)


class SessionResponse(BaseModel):
    id: str
    device: str | None = None
    ip: str | None = None
    created_at: datetime
    last_used_at: datetime
    is_current: bool = False

    class Config:
        from_attributes = True


class ExportDataResponse(BaseModel):
    user: dict
    playlists: list
    liked_tracks: list
    play_history: list
    settings: dict
    sessions: list


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user: "UserResponse"
    message: str


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str
    avatar_url: str | None = None
    country: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if v.lower() in COMMON_PASSWORDS:
            raise ValueError("Password is too common, please choose a stronger one")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


# --- Endpoints ---

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, response: Response, request: Request, session: Session = Depends(get_session)):
    """Register a new user."""
    # Check if email already exists
    existing = session.query(User).filter(User.email == data.email).first()
    if existing:
        # Generic message to prevent email enumeration
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration failed")

    # Hash password
    hashed = hash_password(data.password)

    # Create user
    user = User(
        email=data.email,
        hashed_password=hashed,
        display_name=data.display_name.strip(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    # Create session
    session_model = SessionModel(
        user_id=user.id,
        device=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    )
    session.add(session_model)
    session.commit()
    session.refresh(session_model)

    # Create JWT
    token = create_access_token(user.id, str(session_model.id))
    set_auth_cookie(response, token)

    logger.info(f"User registered: {user.id}")

    return AuthResponse(
        user=UserResponse.model_validate(user),
        message="Registration successful",
    )


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, response: Response, request: Request, session: Session = Depends(get_session)):
    """Login user and create session."""
    email = data.email

    # Check rate limiting
    if get_failed_login_count(email) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please try again in 15 minutes.",
        )

    # Find user
    user = session.query(User).filter(User.email == email).first()

    # Always verify password (constant-time) to prevent timing attacks
    password_valid = False
    if user:
        password_valid = verify_password(data.password, user.hashed_password)

    if not user or not password_valid:
        record_failed_login(email)
        # Generic message to prevent email enumeration
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # Clear failed attempts on successful login
    clear_failed_logins(email)

    # Create session
    session_model = SessionModel(
        user_id=user.id,
        device=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    )
    session.add(session_model)
    session.commit()
    session.refresh(session_model)

    # Create JWT
    token = create_access_token(user.id, str(session_model.id))
    set_auth_cookie(response, token)

    logger.info(f"User logged in: {user.id}")

    return AuthResponse(
        user=UserResponse.model_validate(user),
        message="Login successful",
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse.model_validate(current_user)


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response, current_user: User = Depends(get_current_user), session: Session = Depends(get_session), token: str = Depends(get_token_from_request)):
    """Logout user and revoke session."""
    if token:
        payload = decode_token(token)
        if payload:
            session_id = payload.get("sid")
            if session_id:
                db_session = session.get(SessionModel, session_id)
                if db_session:
                    db_session.revoked = True
                    session.add(db_session)
                    session.commit()

    clear_auth_cookie(response)
    logger.info(f"User logged out: {current_user.id}")
    return MessageResponse(message="Logged out successfully")


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(data: ForgotPasswordRequest, response: Response, request: Request, session: Session = Depends(get_session)):
    """Request password reset - always returns same response."""
    email = data.email

    # Always return success to prevent email enumeration
    user = session.query(User).filter(User.email == email).first()

    if user and settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        # Generate secure token
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_password(raw_token)

        # Create reset token (30 min expiry)
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        session.add(reset_token)
        session.commit()

        # Send email
        reset_link = f"{settings.ALLOWED_ORIGINS[0] if settings.ALLOWED_ORIGINS and settings.ALLOWED_ORIGINS != ['*'] else 'http://localhost:8000'}/reset-password?token={raw_token}"
        send_reset_email(user.email, reset_link)

        logger.info(f"Password reset email sent to: {email}")
    elif user and settings.ENV == "dev":
        # Dev mode: log the reset link
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_password(raw_token)

        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        session.add(reset_token)
        session.commit()

        reset_link = f"http://localhost:8000/reset-password?token={raw_token}"
        logger.warning(f"DEV MODE - Password reset link for {email}: {reset_link}")

    # Always return same response
    return MessageResponse(message="If the email exists, a password reset link has been sent")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(data: ResetPasswordRequest, response: Response, request: Request, session: Session = Depends(get_session)):
    """Reset password with token."""
    # Find token by checking all unexpired, unused tokens
    tokens = session.query(PasswordResetToken).filter(
        PasswordResetToken.expires_at > datetime.now(timezone.utc),
        PasswordResetToken.used == False,
    ).all()

    valid_token = None
    for token in tokens:
        if verify_password(data.token, token.token_hash):
            valid_token = token
            break

    if not valid_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    # Get user
    user = session.get(User, valid_token.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")

    # Hash new password
    hashed = hash_password(data.password)
    user.hashed_password = hashed
    session.add(user)

    # Mark token as used
    valid_token.used = True
    session.add(valid_token)

    # Revoke all user sessions (force re-login)
    user_sessions = session.query(SessionModel).filter(SessionModel.user_id == user.id).all()
    for s in user_sessions:
        s.revoked = True
        session.add(s)

    session.commit()
    clear_auth_cookie(response)

    logger.info(f"Password reset for user: {user.id}")
    return MessageResponse(message="Password has been reset. Please log in again.")


# --- Account Management Endpoints ---

@router.get("/sessions", response_model=list[SessionResponse])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    token: str = Depends(get_token_from_request),
):
    """Get all active sessions for the current user."""
    current_payload = decode_token(token) if token else None
    current_session_id = current_payload.get("sid") if current_payload else None
    
    sessions = session.query(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.revoked == False,
        SessionModel.expires_at > datetime.now(timezone.utc),
    ).order_by(SessionModel.last_used_at.desc()).all()
    
    return [
        SessionResponse(
            id=s.id,
            device=s.device,
            ip=s.ip,
            created_at=s.created_at,
            last_used_at=s.last_used_at,
            is_current=(s.id == current_session_id),
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    token: str = Depends(get_token_from_request),
):
    """Revoke a specific session."""
    current_payload = decode_token(token) if token else None
    current_session_id = current_payload.get("sid") if current_payload else None
    
    # Cannot revoke current session via this endpoint (use logout instead)
    if session_id == current_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot revoke current session. Use logout instead."
        )
    
    db_session = session.get(SessionModel, session_id)
    if not db_session or db_session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    
    db_session.revoked = True
    session.add(db_session)
    session.commit()
    
    logger.info(f"User {current_user.id} revoked session {session_id}")
    return MessageResponse(message="Session revoked")


@router.post("/sessions/revoke-all", response_model=MessageResponse)
async def revoke_all_other_sessions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    token: str = Depends(get_token_from_request),
):
    """Revoke all sessions except the current one."""
    current_payload = decode_token(token) if token else None
    current_session_id = current_payload.get("sid") if current_payload else None
    
    sessions = session.query(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.revoked == False,
    ).all()
    
    count = 0
    for s in sessions:
        if s.id != current_session_id:
            s.revoked = True
            session.add(s)
            count += 1
    
    session.commit()
    logger.info(f"User {current_user.id} revoked {count} other sessions")
    return MessageResponse(message=f"Signed out of {count} other device(s)")


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    data: ChangePasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    token: str = Depends(get_token_from_request),
):
    """Change password (requires current password; revokes other sessions)."""
    # Verify current password
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Hash new password
    hashed = hash_password(data.new_password)
    current_user.hashed_password = hashed
    session.add(current_user)
    
    # Revoke all other sessions
    current_payload = decode_token(token) if token else None
    current_session_id = current_payload.get("sid") if current_payload else None
    
    user_sessions = session.query(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.revoked == False,
    ).all()
    
    for s in user_sessions:
        if s.id != current_session_id:
            s.revoked = True
            session.add(s)
    
    session.commit()
    clear_auth_cookie(response)
    
    logger.info(f"User {current_user.id} changed password")
    return MessageResponse(message="Password changed. Please log in again.")


@router.post("/upload-avatar")
async def upload_avatar(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Upload avatar image."""
    if not settings.STORAGE_PROVIDER:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Avatar upload not configured"
        )
    
    from backend.services.storage import delete_avatar
    from backend.services.storage import upload_avatar as storage_upload_avatar
    
    # Delete old avatar if exists
    if current_user.avatar_url:
        delete_avatar(current_user.id, current_user.avatar_url)
    
    # Upload new avatar
    avatar_url = await storage_upload_avatar(file, current_user.id)
    
    # Update user
    current_user.avatar_url = avatar_url
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    
    return {"avatar_url": avatar_url}


@router.get("/export-data")
async def export_data(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Export all user data as JSON."""
    from backend.models import (
        LikedTrack,
        PlayEvent,
        Playlist,
        PlaylistTrack,
        UserSettings,
    )
    from backend.models import Session as SessionModel
    
    # Get all user data
    playlists = session.query(Playlist).filter(Playlist.user_id == current_user.id).all()
    playlist_data = []
    for pl in playlists:
        tracks = session.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == pl.id).order_by(PlaylistTrack.position).all()
        playlist_data.append({
            "id": pl.id,
            "name": pl.name,
            "description": pl.description,
            "created_at": pl.created_at.isoformat() if pl.created_at else None,
            "tracks": [
                {
                    "id": t.id,
                    "yt_id": t.yt_id,
                    "title": t.title,
                    "artist": t.artist,
                    "album": t.album,
                    "duration": t.duration,
                    "position": t.position,
                }
                for t in tracks
            ],
        })
    
    liked_tracks = session.query(LikedTrack).filter(LikedTrack.user_id == current_user.id).all()
    likes_data = [
        {
            "id": l.id,
            "yt_id": l.yt_id,
            "title": l.title,
            "artist": l.artist,
            "album": l.album,
            "duration": l.duration,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in liked_tracks
    ]
    
    play_events = session.query(PlayEvent).filter(PlayEvent.user_id == current_user.id).order_by(PlayEvent.played_at.desc()).limit(1000).all()
    history_data = [
        {
            "id": e.id,
            "yt_id": e.yt_id,
            "title": e.title,
            "artist": e.artist,
            "played_at": e.played_at.isoformat() if e.played_at else None,
        }
        for e in play_events
    ]
    
    user_settings = session.get(UserSettings, current_user.id)
    settings_data = user_settings.data if user_settings else {}
    
    sessions = session.query(SessionModel).filter(SessionModel.user_id == current_user.id).all()
    sessions_data = [
        {
            "id": s.id,
            "device": s.device,
            "ip": s.ip,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "revoked": s.revoked,
        }
        for s in sessions
    ]
    
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "display_name": current_user.display_name,
            "avatar_url": current_user.avatar_url,
            "country": current_user.country,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "playlists": playlist_data,
        "liked_tracks": likes_data,
        "play_history": history_data,
        "settings": settings_data,
        "sessions": sessions_data,
    }


@router.post("/delete-account", response_model=MessageResponse)
async def delete_account(
    data: DeleteAccountRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Delete account (requires password confirmation; deletes all data)."""
    # Verify password
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password is incorrect"
        )
    
    user_id = current_user.id
    
    # Delete avatar from storage
    if current_user.avatar_url:
        from backend.services.storage import delete_avatar
        delete_avatar(user_id, current_user.avatar_url)
    
    # Delete all related data (cascades should handle most, but be explicit)
    # Sessions
    session.query(SessionModel).filter(SessionModel.user_id == user_id).delete()
    # Playlists (cascades to tracks)
    session.query(Playlist).filter(Playlist.user_id == user_id).delete()
    # Liked tracks
    session.query(LikedTrack).filter(LikedTrack.user_id == user_id).delete()
    # Play events
    session.query(PlayEvent).filter(PlayEvent.user_id == user_id).delete()
    # User settings
    session.query(UserSettings).filter(UserSettings.user_id == user_id).delete()
    # Password reset tokens
    session.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete()
    # User
    session.delete(current_user)
    
    session.commit()
    clear_auth_cookie(response)
    
    logger.info(f"User {user_id} deleted their account")
    return MessageResponse(message="Account deleted successfully")


def send_reset_email(to_email: str, reset_link: str) -> None:
    """Send password reset email via SMTP."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASSWORD, settings.SMTP_FROM_EMAIL]):
        logger.warning("SMTP not fully configured, skipping email send")
        return

    msg = MIMEMultipart()
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = "Neuro Music - Password Reset Request"

    body = f"""
    <html>
    <body>
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your Neuro Music account.</p>
        <p><a href="{reset_link}">Click here to reset your password</a></p>
        <p>This link expires in 30 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
    </body>
    </html>
    """
    msg.attach(MIMEText(body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Password reset email sent to {to_email}")
    except (smtplib.SMTPException, OSError) as e:
        logger.error(f"Failed to send reset email: {e}")