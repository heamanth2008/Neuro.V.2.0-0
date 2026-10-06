"""Tests for auth endpoints - additional coverage."""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from jose import jwt
from sqlmodel import Session

from backend.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    get_current_user,
    get_token_from_request,
)
from backend.models import User, Session as SessionModel
from backend.config import settings


class TestAuthPasswordHashing:
    def test_hash_password(self):
        password = "TestPass123"
        hashed = hash_password(password)
        assert hashed != password
        assert len(hashed) > 50

    def test_verify_password_correct(self):
        password = "TestPass123"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        password = "TestPass123"
        hashed = hash_password(password)
        assert verify_password("WrongPass123", hashed) is False

    def test_verify_password_empty(self):
        assert verify_password("", "hash") is False


class TestAuthTokens:
    def test_create_access_token(self):
        token = create_access_token(1, "session-123")
        assert isinstance(token, str)
        assert len(token) > 100

    def test_decode_token_valid(self):
        token = create_access_token(1, "session-123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "1"
        assert payload["sid"] == "session-123"

    def test_decode_token_expired(self):
        import time
        payload = {"sub": "1", "sid": "session-123", "exp": int(time.time()) - 100}
        token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
        result = decode_token(token)
        assert result is None

    def test_decode_token_invalid_signature(self):
        payload = {"sub": "1", "sid": "session-123", "exp": int(time.time()) + 10000}
        token = jwt.encode(payload, "wrong-secret", algorithm=settings.JWT_ALGORITHM)
        result = decode_token(token)
        assert result is None


class TestAuthEndpointsAdditional:
    """Test auth endpoints that need more coverage."""

    def test_upload_avatar_endpoint(self, client, auth_headers):
        """Test avatar upload endpoint."""
        from io import BytesIO
        from PIL import Image

        img = Image.new("RGB", (100, 100), color="blue")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        content = buffer.getvalue()

        with patch("backend.services.storage.upload_avatar", return_value="https://cdn.example.com/avatar.png") as mock_upload:
            response = client.post(
                "/api/auth/upload-avatar",
                files={"file": ("test.png", content, "image/png")},
                headers=auth_headers,
            )

        assert response.status_code == 200
        assert "avatar_url" in response.json()
        mock_upload.assert_called_once()

    def test_upload_avatar_not_configured(self, client, auth_headers):
        """Test avatar upload when storage not configured."""
        from io import BytesIO
        from PIL import Image

        img = Image.new("RGB", (100, 100), color="blue")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        content = buffer.getvalue()

        with patch("backend.services.storage.settings.STORAGE_PROVIDER", None):
            response = client.post(
                "/api/auth/upload-avatar",
                files={"file": ("test.png", content, "image/png")},
                headers=auth_headers,
            )

        assert response.status_code == 501

    def test_export_data_endpoint(self, client, auth_headers, session):
        """Test export data endpoint."""
        response = client.get("/api/auth/export-data", headers=auth_headers)
        assert response.status_code == 200

        data = response.json()
        assert "user" in data
        assert "playlists" in data
        assert "liked_tracks" in data
        assert "play_history" in data
        assert "settings" in data
        assert "sessions" in data

        # Verify no password hash in export
        assert "hashed_password" not in str(data)
        assert "password" not in data["user"]

    def test_delete_account_endpoint(self, client, auth_headers, session):
        """Test delete account endpoint."""
        user = session.query(User).filter(User.email == "test@example.com").first()
        assert user is not None

        response = client.post(
            "/api/auth/delete-account",
            json={"password": "TestPass123"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

        # Verify user is deleted
        deleted_user = session.get(User, user.id)
        assert deleted_user is None

    def test_delete_account_wrong_password(self, client, auth_headers):
        """Test delete account with wrong password."""
        response = client.post(
            "/api/auth/delete-account",
            json={"password": "WrongPass123"},
            headers=auth_headers,
        )

        assert response.status_code == 401

    def test_change_password_endpoint(self, client, auth_headers, session):
        """Test change password endpoint."""
        response = client.post(
            "/api/auth/change-password",
            json={
                "current_password": "TestPass123",
                "new_password": "NewPass456",
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert "changed" in response.json()["message"].lower()

        # Verify new password works
        response = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "NewPass456"},
        )
        assert response.status_code == 200

    def test_change_password_wrong_current(self, client, auth_headers):
        """Test change password with wrong current password."""
        response = client.post(
            "/api/auth/change-password",
            json={
                "current_password": "WrongPass123",
                "new_password": "NewPass456",
            },
            headers=auth_headers,
        )

        assert response.status_code == 401

    def test_change_password_weak_new(self, client, auth_headers):
        """Test change password with weak new password."""
        response = client.post(
            "/api/auth/change-password",
            json={
                "current_password": "TestPass123",
                "new_password": "weak",
            },
            headers=auth_headers,
        )

        assert response.status_code == 422  # Validation error

    def test_get_sessions_endpoint(self, client, auth_headers):
        """Test get sessions endpoint."""
        response = client.get("/api/auth/sessions", headers=auth_headers)
        assert response.status_code == 200

        sessions = response.json()
        assert isinstance(sessions, list)
        if sessions:
            session = sessions[0]
            assert "id" in session
            assert "device" in session
            assert "created_at" in session
            assert "last_used_at" in session
            assert "is_current" in session

    def test_revoke_session_endpoint(self, client, auth_headers, session):
        """Test revoke session endpoint."""
        # Create another session
        user = session.query(User).filter(User.email == "test@example.com").first()
        other_session = SessionModel(
            user_id=user.id,
            device="Other Device",
            ip="192.168.1.1",
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        session.add(other_session)
        session.commit()
        session.refresh(other_session)

        # Revoke it
        response = client.delete(
            f"/api/auth/sessions/{other_session.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

        # Verify revoked
        session.refresh(other_session)
        assert other_session.revoked is True

    def test_revoke_current_session_fails(self, client, auth_headers):
        """Test that current session cannot be revoked via this endpoint."""
        import json
        # Get current session ID from token
        token = auth_headers["Cookie"].split("auth_token=")[1].split(";")[0]
        payload = decode_token(token)
        current_session_id = payload.get("sid")

        response = client.delete(
            f"/api/auth/sessions/{current_session_id}",
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_revoke_all_other_sessions(self, client, auth_headers, session):
        """Test revoke all other sessions endpoint."""
        user = session.query(User).filter(User.email == "test@example.com").first()

        # Create multiple other sessions
        for i in range(3):
            other_session = SessionModel(
                user_id=user.id,
                device=f"Device {i}",
                ip="192.168.1.1",
                expires_at=datetime.now(timezone.utc) + timedelta(days=30),
            )
            session.add(other_session)
        session.commit()

        response = client.post("/api/auth/sessions/revoke-all", headers=auth_headers)
        assert response.status_code == 200
        assert "signed out" in response.json()["message"].lower()

        # Verify all other sessions revoked
        sessions = session.query(SessionModel).filter(
            SessionModel.user_id == user.id,
            SessionModel.revoked == False,
        ).all()
        # Only current session should remain
        assert len(sessions) == 1

    def test_forgot_password_endpoint(self, client, session):
        """Test forgot password endpoint (always returns same response)."""
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 200
        assert "sent" in response.json()["message"].lower()

    def test_forgot_password_nonexistent(self, client):
        """Test forgot password with nonexistent email (same response)."""
        response = client.post(
            "/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )
        assert response.status_code == 200
        assert "sent" in response.json()["message"].lower()

    def test_reset_password_endpoint(self, client, session):
        """Test reset password with valid token."""
        from backend.auth import hash_password
        import secrets

        user = session.query(User).filter(User.email == "test@example.com").first()
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_password(raw_token)

        from backend.models import PasswordResetToken
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        session.add(reset_token)
        session.commit()

        response = client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "password": "NewPass789"},
        )
        assert response.status_code == 200

        # Verify password changed
        session.refresh(user)
        assert verify_password("NewPass789", user.hashed_password)

    def test_reset_password_invalid_token(self, client):
        """Test reset password with invalid token."""
        response = client.post(
            "/api/auth/reset-password",
            json={"token": "invalid", "password": "NewPass789"},
        )
        assert response.status_code == 400

    def test_reset_password_expired_token(self, client, session):
        """Test reset password with expired token."""
        from backend.auth import hash_password
        import secrets

        user = session.query(User).filter(User.email == "test@example.com").first()
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_password(raw_token)

        from backend.models import PasswordResetToken
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # Expired
        )
        session.add(reset_token)
        session.commit()

        response = client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "password": "NewPass789"},
        )
        assert response.status_code == 400

    def test_reset_password_reused_token(self, client, session):
        """Test reset password with already used token."""
        from backend.auth import hash_password
        import secrets

        user = session.query(User).filter(User.email == "test@example.com").first()
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_password(raw_token)

        from backend.models import PasswordResetToken
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
            used=True,
        )
        session.add(reset_token)
        session.commit()

        response = client.post(
            "/api/auth/reset-password",
            json={"token": raw_token, "password": "NewPass789"},
        )
        assert response.status_code == 400


# Need to import verify_password for the test
from backend.auth import verify_password