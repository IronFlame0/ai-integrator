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
        {"id": CHAT_ID, "title": "Test Chat", "created_at": "2024-01-01", "updated_at": "2024-01-01"}
    ]
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get("/api/chats", headers=AUTH)
    assert resp.status_code == 200
    assert len(resp.json()) == 1


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
    mock_pool.fetchrow.return_value = {"request_count": 10}
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get("/api/chats/usage/today", headers=AUTH)
    assert resp.status_code == 200
    data = resp.json()
    assert data["used"] == 10
    assert data["limit"] == 50
    assert data["remaining"] == 40


async def test_get_usage_no_record(client, mock_pool):
    mock_pool.fetchrow.return_value = None
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.get("/api/chats/usage/today", headers=AUTH)
    assert resp.status_code == 200
    assert resp.json()["used"] == 0


async def test_increment_usage_below_limit(client, mock_pool):
    mock_pool.fetchrow.side_effect = [
        {"request_count": 5},
        {"request_count": 6},
    ]
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post("/api/chats/usage/increment", headers=AUTH)
    assert resp.status_code == 200


async def test_increment_usage_at_limit(client, mock_pool):
    mock_pool.fetchrow.return_value = {"request_count": 50}
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post("/api/chats/usage/increment", headers=AUTH)
    assert resp.status_code == 429


async def test_increment_usage_exceeded(client, mock_pool):
    mock_pool.fetchrow.return_value = {"request_count": 51}
    with patch("routers.chats.get_pool", AsyncMock(return_value=mock_pool)):
        resp = await client.post("/api/chats/usage/increment", headers=AUTH)
    assert resp.status_code == 429


async def test_chats_require_auth(client):
    resp = await client.get("/api/chats")
    assert resp.status_code == 403
