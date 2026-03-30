from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.llm import stream_chat

router = APIRouter()


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


@router.post("/api/chat")
async def chat(req: ChatRequest):
    messages = [m.model_dump() for m in req.messages]

    return StreamingResponse(
        stream_chat(messages),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
