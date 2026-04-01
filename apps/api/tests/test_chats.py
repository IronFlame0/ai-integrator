import pytest
from unittest.mock import AsyncMock, patch
from core.security import create_token

USER_ID = "user-uuid-123"
CHAT_ID = "chat-uuid-456"
TOKEN = create_token(USER_ID, "user@example.com")
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def mock_pool():
    return AsyncMock()


async def test_list_chats(client, mock_pool):
    mock_pool.fetch.return_value = [
        {"id": CHAT_ID, "title": "Test Chat", "context_tokens": 1024,
         "created_at": "2024-01-01", "updated_at": "2024-01-01"}
    ]
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get("/api/chats", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["context_tokens"] == 1024


async def test_list_chats_empty(client, mock_pool):
    mock_pool.fetch.return_value = []
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get("/api/chats", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_chat(client, mock_pool):
    mock_pool.fetchrow.return_value = {
        "id": CHAT_ID, "title": "New chat", "created_at": "2024-01-01", "updated_at": "2024-01-01"
    }
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post("/api/chats", headers=AUTH)
    assert resp.status_code == 201
    assert resp.json()["id"] == CHAT_ID


async def test_delete_chat(client, mock_pool):
    mock_pool.execute = AsyncMock()
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.delete(f"/api/chats/{CHAT_ID}", headers=AUTH)
    assert resp.status_code == 204


async def test_update_title(client, mock_pool):
    mock_pool.fetchrow.return_value = {"id": CHAT_ID, "title": "Updated Title"}
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.patch(
            f"/api/chats/{CHAT_ID}/title",
            json={"title": "Updated Title"},
            headers=AUTH,
        )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


async def test_list_messages(client, mock_pool):
    mock_pool.fetch.return_value = [
        {"id": "msg-1", "role": "user", "content": "Hello", "created_at": "2024-01-01"}
    ]
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get(f"/api/chats/{CHAT_ID}/messages", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()[0]["role"] == "user"


async def test_save_message(client, mock_pool):
    mock_pool.fetchrow.return_value = {
        "id": "msg-1", "role": "user", "content": "Hello", "created_at": "2024-01-01"
    }
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            f"/api/chats/{CHAT_ID}/messages",
            json={"role": "user", "content": "Hello"},
            headers=AUTH,
        )
    assert resp.status_code == 201


async def test_save_message_invalid_role(client, mock_pool):
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            f"/api/chats/{CHAT_ID}/messages",
            json={"role": "system", "content": "Injected"},
            headers=AUTH,
        )
    assert resp.status_code == 422


async def test_get_usage(client, mock_pool):
    mock_pool.fetchrow.return_value = {"token_count": 5000}
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get("/api/chats/usage/today", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["used"] == 5000
    assert data["limit"] == 100_000
    assert data["remaining"] == 95_000


async def test_get_usage_no_record(client, mock_pool):
    mock_pool.fetchrow.return_value = None
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get("/api/chats/usage/today", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["used"] == 0
    assert data["remaining"] == 100_000


async def test_increment_usage_below_limit(client, mock_pool):
    # Atomic upsert returns updated row when under limit
    mock_pool.fetchrow.return_value = {"token_count": 2500}
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/chats/usage/increment",
            json={"tokens": 1500},
            headers=AUTH,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["used"] == 2500
    assert data["remaining"] == 97_500


async def test_increment_usage_at_limit(client, mock_pool):
    # Atomic upsert returns None when WHERE usage.token_count < LIMIT is false
    mock_pool.fetchrow.return_value = None
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/chats/usage/increment",
            json={"tokens": 100},
            headers=AUTH,
        )
    assert resp.status_code == 429


async def test_increment_usage_exceeded(client, mock_pool):
    mock_pool.fetchrow.return_value = None
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/chats/usage/increment",
            json={"tokens": 100},
            headers=AUTH,
        )
    assert resp.status_code == 429


async def test_increment_usage_invalid_tokens(client, mock_pool):
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/chats/usage/increment",
            json={"tokens": 0},
            headers=AUTH,
        )
    assert resp.status_code == 422


async def test_increment_usage_too_many_tokens(client, mock_pool):
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post(
            "/api/chats/usage/increment",
            json={"tokens": 200_001},
            headers=AUTH,
        )
    assert resp.status_code == 422


async def test_update_context(client, mock_pool):
    mock_pool.fetchrow.return_value = {"id": CHAT_ID, "context_tokens": 4096}
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.patch(
            f"/api/chats/{CHAT_ID}/context",
            json={"context_tokens": 4096},
            headers=AUTH,
        )
    assert resp.status_code == 200
    assert resp.json()["context_tokens"] == 4096


async def test_update_context_not_found(client, mock_pool):
    mock_pool.fetchrow.return_value = None
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.patch(
            f"/api/chats/{CHAT_ID}/context",
            json={"context_tokens": 100},
            headers=AUTH,
        )
    assert resp.status_code == 404


async def test_update_context_negative(client, mock_pool):
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.patch(
            f"/api/chats/{CHAT_ID}/context",
            json={"context_tokens": -1},
            headers=AUTH,
        )
    assert resp.status_code == 422


async def test_chats_require_auth(client):
    resp = await client.get("/api/chats")
    assert resp.status_code == 403
