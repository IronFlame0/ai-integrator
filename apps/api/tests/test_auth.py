import pytest
from unittest.mock import AsyncMock, patch
from core.security import hash_password, create_token


@pytest.fixture
def mock_pool():
    return AsyncMock()


async def test_register_success(client, mock_pool):
    mock_pool.fetchrow.side_effect = [
        None,
        {"id": "uuid-123", "email": "new@example.com", "created_at": "2024-01-01"},
    ]
    with patch("routers.auth.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/auth/register",
            json={"email": "new@example.com", "password": "password123"},
        )
    assert resp.status_code == 201
    data = resp.json()
    assert "token" in data
    assert data["user"]["email"] == "new@example.com"


async def test_register_short_password(client):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "12345"},
    )
    assert resp.status_code == 422


async def test_register_duplicate_email(client, mock_pool):
    mock_pool.fetchrow.return_value = {"id": "existing-id"}
    with patch("routers.auth.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/auth/register",
            json={"email": "exists@example.com", "password": "password123"},
        )
    assert resp.status_code == 409


async def test_login_success(client, mock_pool):
    hashed = hash_password("password123")
    mock_pool.fetchrow.return_value = {
        "id": "uuid-123",
        "email": "user@example.com",
        "hashed_password": hashed,
        "is_active": True,
    }
    with patch("routers.auth.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "password123"},
        )
    assert resp.status_code == 200
    assert "token" in resp.json()


async def test_login_wrong_password(client, mock_pool):
    hashed = hash_password("correctpassword")
    mock_pool.fetchrow.return_value = {
        "id": "uuid-123",
        "email": "user@example.com",
        "hashed_password": hashed,
        "is_active": True,
    }
    with patch("routers.auth.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/auth/login",
            json={"email": "user@example.com", "password": "wrongpassword"},
        )
    assert resp.status_code == 401


async def test_login_user_not_found(client, mock_pool):
    mock_pool.fetchrow.return_value = None
    with patch("routers.auth.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/auth/login",
            json={"email": "ghost@example.com", "password": "password123"},
        )
    assert resp.status_code == 401


async def test_me_valid_token(client):
    token = create_token("user-id-123", "user@example.com")
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "user@example.com"


async def test_me_invalid_token(client):
    resp = await client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token"},
    )
    assert resp.status_code == 401
