import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, auth
from core.db import get_pool, close_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()


app = FastAPI(title="AI Integrator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)


@app.get("/api/health")
async def health():
    # Реальная проверка соединения с БД
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        db_status = "ok"
        db_host = os.getenv("DATABASE_URL", "").split("@")[-1].split("/")[0]
    except Exception as e:
        db_status = f"error: {str(e)}"
        db_host = "unknown"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "db_host": db_host,
    }
