import os
from fastapi import APIRouter

router = APIRouter(prefix="/api/models", tags=["models"])

ALL_MODELS = [
    # Google Gemini
    {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash", "provider": "google",    "context_limit": 1_048_576},
    {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash", "provider": "google",    "context_limit": 1_048_576},
    {"id": "gemini-2.5-pro",   "label": "Gemini 2.5 Pro",   "provider": "google",    "context_limit": 1_048_576},
    # OpenAI
    {"id": "gpt-4o",           "label": "GPT-4o",           "provider": "openai",    "context_limit": 128_000},
    {"id": "gpt-4o-mini",      "label": "GPT-4o mini",      "provider": "openai",    "context_limit": 128_000},
    {"id": "o3-mini",          "label": "o3-mini",          "provider": "openai",    "context_limit": 200_000},
    # Anthropic Claude
    {"id": "claude-opus-4-6",          "label": "Claude Opus 4.6",    "provider": "anthropic", "context_limit": 200_000},
    {"id": "claude-sonnet-4-6",        "label": "Claude Sonnet 4.6",  "provider": "anthropic", "context_limit": 200_000},
    {"id": "claude-haiku-4-5-20251001","label": "Claude Haiku 4.5",   "provider": "anthropic", "context_limit": 200_000},
]

PROVIDER_ENV = {
    "google":    "GEMINI_API_KEY",
    "openai":    "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}


@router.get("")
async def list_models():
    print(PROVIDER_ENV)
    return [
        m for m in ALL_MODELS
        if os.getenv(PROVIDER_ENV.get(m["provider"], ""))
    ]
