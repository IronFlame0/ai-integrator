import os
from openai import AsyncOpenAI
from typing import AsyncGenerator


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
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            yield f"data: [ERROR] Model {model} quota exceeded\n\n"
        elif "400" in error_msg or "API_KEY_INVALID" in error_msg:
            yield "data: [ERROR] Invalid API key\n\n"
        else:
            yield f"data: [ERROR] {error_msg}\n\n"

    yield "data: [DONE]\n\n"
