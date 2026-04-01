from fastapi import APIRouter

router = APIRouter(prefix="/api/models", tags=["models"])

MODELS = [
    {
        "id": "gemini-2.5-flash",
        "label": "Gemini 2.5 Flash",
        "context_limit": 1_048_576,
    },
    {
        "id": "gemini-2.0-flash",
        "label": "Gemini 2.0 Flash",
        "context_limit": 1_048_576,
    },
    {
        "id": "gemini-2.5-pro",
        "label": "Gemini 2.5 Pro",
        "context_limit": 1_048_576,
    },
]


@router.get("")
async def list_models():
    return MODELS
