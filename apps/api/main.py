import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, auth, chats, models
from core.db import get_pool, close_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()


app = FastAPI(title="AI Integrator API", lifespan=lifespan)

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth.router)
app.include_router(chats.router)
app.include_router(chat.router)
app.include_router(models.router)


@app.get("/api/health")
async def health():
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {str(e)}"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
    }
