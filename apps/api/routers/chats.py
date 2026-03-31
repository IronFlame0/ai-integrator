from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from enum import Enum
from core.db import get_pool
from core.deps import get_current_user

router = APIRouter(prefix="/api/chats", tags=["chats"])

DAILY_LIMIT = 50


class UpdateTitleRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"


class SaveMessageRequest(BaseModel):
    role: MessageRole
    content: str = Field(..., min_length=1, max_length=10000)


@router.get("")
async def list_chats(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, title, created_at, updated_at FROM chats "
        "WHERE user_id = $1 ORDER BY updated_at DESC",
        user["id"],
    )
    return [dict(r) for r in rows]


@router.post("", status_code=201)
async def create_chat(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO chats (user_id, title) VALUES ($1, $2) "
        "RETURNING id, title, created_at, updated_at",
        user["id"], "New chat",
    )
    return dict(row)


@router.delete("/{chat_id}", status_code=204)
async def delete_chat(chat_id: str, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    await pool.execute(
        "DELETE FROM chats WHERE id = $1 AND user_id = $2",
        chat_id, user["id"],
    )


@router.patch("/{chat_id}/title")
async def update_title(
    chat_id: str,
    body: UpdateTitleRequest,
    user: dict = Depends(get_current_user),
):
    pool = await get_pool()
    row = await pool.fetchrow(
        "UPDATE chats SET title = $1 WHERE id = $2 AND user_id = $3 "
        "RETURNING id, title",
        body.title, chat_id, user["id"],
    )
    return dict(row)


@router.get("/{chat_id}/messages")
async def list_messages(chat_id: str, user: dict = Depends(get_current_user)):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, role, content, created_at FROM messages "
        "WHERE chat_id = $1 AND user_id = $2 ORDER BY created_at ASC",
        chat_id, user["id"],
    )
    return [dict(r) for r in rows]


@router.post("/{chat_id}/messages", status_code=201)
async def save_message(
    chat_id: str,
    body: SaveMessageRequest,
    user: dict = Depends(get_current_user),
):
    pool = await get_pool()
    row = await pool.fetchrow(
        "INSERT INTO messages (chat_id, user_id, role, content) "
        "VALUES ($1, $2, $3, $4) "
        "RETURNING id, role, content, created_at",
        chat_id, user["id"], body.role.value, body.content,
    )
    return dict(row)


@router.get("/usage/today")
async def get_usage(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT request_count FROM usage "
        "WHERE user_id = $1 AND date = CURRENT_DATE",
        user["id"],
    )
    count = row["request_count"] if row else 0
    return {
        "used": count,
        "limit": DAILY_LIMIT,
        "remaining": max(0, DAILY_LIMIT - count),
    }


@router.post("/usage/increment")
async def increment_usage(user: dict = Depends(get_current_user)):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT request_count FROM usage "
        "WHERE user_id = $1 AND date = CURRENT_DATE",
        user["id"],
    )
    count = row["request_count"] if row else 0
    if count >= DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {DAILY_LIMIT} requests exceeded",
        )
    row = await pool.fetchrow(
        "INSERT INTO usage (user_id, date, request_count) "
        "VALUES ($1, CURRENT_DATE, 1) "
        "ON CONFLICT (user_id, date) DO UPDATE "
        "SET request_count = usage.request_count + 1 "
        "RETURNING request_count",
        user["id"],
    )
    count = row["request_count"]
    return {"used": count, "limit": DAILY_LIMIT, "remaining": DAILY_LIMIT - count}
