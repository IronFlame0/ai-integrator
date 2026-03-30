import os
from openai import AsyncOpenAI
from typing import AsyncGenerator

# Модели Gemini для fallback
MODELS = [
    "gemini-2.5-flash-preview-05-20",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
]


async def stream_chat(messages: list[dict]) -> AsyncGenerator[str, None]:
    client = AsyncOpenAI(
        api_key=os.getenv("GEMINI_API_KEY"),
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
    )

    model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield f"data: {delta}\n\n"

    except Exception as e:
        error_msg = str(e)
        # Подсказка если квота
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            yield f"data: [ERROR] Квота модели {model} исчерпана. Попробуй сменить GEMINI_MODEL в .env\n\n"
        elif "400" in error_msg or "API_KEY_INVALID" in error_msg:
            yield "data: [ERROR] Неверный API ключ. Проверь GEMINI_API_KEY в .env\n\n"
        else:
            yield f"data: [ERROR] {error_msg}\n\n"

    yield "data: [DONE]\n\n"
