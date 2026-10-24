"""Tests for authentication endpoints."""
import os

os.environ["ENV"] = "test"

import pytest
from backend.auth import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from backend.db import get_session
from backend.main import app
from backend.models import User
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

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


def test_hash_password():
    """Test password hashing and verification."""
    password = "TestPassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("WrongPassword123", hashed)


def test_create_and_decode_token():
    """Test JWT token creation and decoding."""
    user_id = 1
    session_id = "test-session-id"
    token = create_access_token(user_id, session_id)
    assert isinstance(token, str)
    assert len(token) > 0

    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == str(user_id)
    assert payload["sid"] == session_id
    assert payload["jti"] == session_id


def test_decode_expired_token():
    """Test that expired tokens are rejected."""
    import time

    from backend.config import settings
    from jose import jwt

    # Create a token with past expiry
    payload = {
        "sub": "1",
        "sid": "test",
        "iat": int(time.time()) - 10000,
        "exp": int(time.time()) - 1,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    result = decode_token(token)
    assert result is None


def test_register_success(client: TestClient):
    """Test successful user registration."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "password": "TestPassword123",
            "display_name": "Test User",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Registration successful"
    assert data["user"]["email"] == "test@example.com"
    assert data["user"]["display_name"] == "Test User"
    assert "id" in data["user"]
    assert "hashed_password" not in data["user"]
    # Check cookie is set
    assert "auth_token" in response.cookies


def test_register_duplicate_email(client: TestClient):
    """Test registration with duplicate email returns generic error."""
    # First registration
    client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "password": "TestPassword123",
            "display_name": "Test User",
        },
    )
    # Second registration with same email
    response = client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "password": "AnotherPassword123",
            "display_name": "Another User",
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Registration failed"


def test_register_weak_password(client: TestClient):
    """Test registration with weak password is rejected."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "weak@example.com",
            "password": "password",  # Common password
            "display_name": "Weak User",
        },
    )
    assert response.status_code == 422  # Validation error


def test_register_short_password(client: TestClient):
    """Test registration with password too short is rejected."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "short@example.com",
            "password": "Short1",  # Less than 8 chars
            "display_name": "Short User",
        },
    )
    assert response.status_code == 422


def test_register_invalid_email(client: TestClient):
    """Test registration with invalid email is rejected."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "not-an-email",
            "password": "ValidPassword123",
            "display_name": "Invalid User",
        },
    )
    assert response.status_code == 422


def test_register_empty_display_name(client: TestClient):
    """Test registration with empty display name is rejected."""
    response = client.post(
        "/api/auth/register",
        json={
            "email": "empty@example.com",
            "password": "ValidPassword123",
            "display_name": "",
        },
    )
    assert response.status_code == 422


def test_login_success(client: TestClient):
    """Test successful login."""
    # Register first
    client.post(
        "/api/auth/register",
        json={
            "email": "login@example.com",
            "password": "TestPassword123",
            "display_name": "Login User",
        },
    )
    # Login
    response = client.post(
        "/api/auth/login",
        json={
            "email": "login@example.com",
            "password": "TestPassword123",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Login successful"
    assert data["user"]["email"] == "login@example.com"
    assert "auth_token" in response.cookies


def test_login_wrong_password(client: TestClient):
    """Test login with wrong password is rejected."""
    # Register first
    client.post(
        "/api/auth/register",
        json={
            "email": "wrongpass@example.com",
            "password": "TestPassword123",
            "display_name": "Wrong Pass User",
        },
    )
    # Login with wrong password
    response = client.post(
        "/api/auth/login",
        json={
            "email": "wrongpass@example.com",
            "password": "WrongPassword123",
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"
    assert "auth_token" not in response.cookies


def test_login_nonexistent_user(client: TestClient):
    """Test login with nonexistent user returns generic error."""
    response = client.post(
        "/api/auth/login",
        json={
            "email": "nonexistent@example.com",
            "password": "TestPassword123",
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_rate_limit(client: TestClient):
    """Test rate limiting after 5 failed attempts."""
    email = "ratelimit@example.com"
    # Register user
    client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "TestPassword123",
            "display_name": "Rate Limit User",
        },
    )

    # Make 5 failed attempts
    for _ in range(5):
        response = client.post(
            "/api/auth/login",
            json={"email": email, "password": "WrongPassword"},
        )
        assert response.status_code == 401

    # 6th attempt should be rate limited
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": "WrongPassword"},
    )
    assert response.status_code == 429
    assert "Too many failed attempts" in response.json()["detail"]


def test_me_authenticated(client: TestClient):
    """Test /me endpoint with valid authentication."""
    # Register and login
    client.post(
        "/api/auth/register",
        json={
            "email": "me@example.com",
            "password": "TestPassword123",
            "display_name": "Me User",
        },
    )
    # Get the cookie
    login_response = client.post(
        "/api/auth/login",
        json={"email": "me@example.com", "password": "TestPassword123"},
    )
    auth_token = login_response.cookies.get("auth_token")

    # Call /me with cookie
    response = client.get("/api/auth/me", cookies={"auth_token": auth_token})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["display_name"] == "Me User"
    assert "hashed_password" not in data


def test_me_unauthenticated(client: TestClient):
    """Test /me endpoint without authentication."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_invalid_token(client: TestClient):
    """Test /me endpoint with invalid token."""
    response = client.get("/api/auth/me", cookies={"auth_token": "invalid-token"})
    assert response.status_code == 401


def test_logout(client: TestClient):
    """Test logout revokes session and clears cookie."""
    # Register and login
    client.post(
        "/api/auth/register",
        json={
            "email": "logout@example.com",
            "password": "TestPassword123",
            "display_name": "Logout User",
        },
    )
    login_response = client.post(
        "/api/auth/login",
        json={"email": "logout@example.com", "password": "TestPassword123"},
    )
    auth_token = login_response.cookies.get("auth_token")

    # Call logout
    response = client.post("/api/auth/logout", cookies={"auth_token": auth_token})
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"
    # Cookie should be cleared
    assert "auth_token" in response.headers.get("set-cookie", "")
    assert "Max-Age=0" in response.headers.get("set-cookie", "")

    # Old cookie should be rejected
    response = client.get("/api/auth/me", cookies={"auth_token": auth_token})
    assert response.status_code == 401


def test_forgot_password_nonexistent_email(client: TestClient):
    """Test forgot password with nonexistent email returns same response."""
    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "nonexistent@example.com"},
    )
    assert response.status_code == 200
    assert "If the email exists" in response.json()["message"]


def test_forgot_password_existing_email(client: TestClient):
    """Test forgot password with existing email."""
    # Register user
    client.post(
        "/api/auth/register",
        json={
            "email": "forgot@example.com",
            "password": "TestPassword123",
            "display_name": "Forgot User",
        },
    )
    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "forgot@example.com"},
    )
    assert response.status_code == 200
    assert "If the email exists" in response.json()["message"]


def test_reset_password_invalid_token(client: TestClient):
    """Test reset password with invalid token."""
    response = client.post(
        "/api/auth/reset-password",
        json={"token": "invalid-token", "password": "NewPassword123"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired reset token"


def test_reset_password_reuse_token(client: TestClient, session: Session):
    """Test reset password token cannot be reused."""
    # Register user
    client.post(
        "/api/auth/register",
        json={
            "email": "reuse@example.com",
            "password": "TestPassword123",
            "display_name": "Reuse User",
        },
    )

    # Get user and create reset token directly
    user = session.query(User).filter(User.email == "reuse@example.com").first()
    from backend.auth import hash_password as auth_hash_password
    raw_token = "test-reset-token"
    token_hash = auth_hash_password(raw_token)

    from datetime import datetime, timedelta, timezone

    from backend.models import PasswordResetToken

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    session.add(reset_token)
    session.commit()

    # Use token once
    response = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "password": "NewPassword123"},
    )
    assert response.status_code == 200

    # Try to use same token again
    response = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "password": "AnotherPassword123"},
    )
    assert response.status_code == 400


def test_reset_password_expired_token(client: TestClient, session: Session):
    """Test reset password with expired token."""
    # Register user
    client.post(
        "/api/auth/register",
        json={
            "email": "expired@example.com",
            "password": "TestPassword123",
            "display_name": "Expired User",
        },
    )

    # Get user and create expired reset token
    user = session.query(User).filter(User.email == "expired@example.com").first()
    from backend.auth import hash_password as auth_hash_password
    raw_token = "expired-token"
    token_hash = auth_hash_password(raw_token)

    from datetime import datetime, timedelta, timezone

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
        json={"token": raw_token, "password": "NewPassword123"},
    )
    assert response.status_code == 400


def test_cookie_flags(client: TestClient):
    """Test that auth cookie has correct flags."""
    client.post(
        "/api/auth/register",
        json={
            "email": "cookie@example.com",
            "password": "TestPassword123",
            "display_name": "Cookie User",
        },
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "cookie@example.com", "password": "TestPassword123"},
    )

    set_cookie = response.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie
    assert "samesite=lax" in set_cookie.lower()
    assert "Path=/" in set_cookie
    # In test environment (not production), Secure should not be set
    # In production it would be set


def test_no_password_in_response(client: TestClient):
    """Test that password/hash never appears in responses."""
    # Register
    response = client.post(
        "/api/auth/register",
        json={
            "email": "nopass@example.com",
            "password": "TestPassword123",
            "display_name": "No Pass User",
        },
    )
    assert "hashed_password" not in response.text
    assert "TestPassword123" not in response.text

    # Login
    response = client.post(
        "/api/auth/login",
        json={"email": "nopass@example.com", "password": "TestPassword123"},
    )
    assert "hashed_password" not in response.text
    assert "TestPassword123" not in response.text

    # Me
    auth_token = response.cookies.get("auth_token")
    response = client.get("/api/auth/me", cookies={"auth_token": auth_token})
    assert "hashed_password" not in response.text
    assert "TestPassword123" not in response.text