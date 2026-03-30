import { streamText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
  const start = Date.now();
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  console.log(`[chat] → request started, model: ${model}`);

  const { messages } = await req.json();
  console.log(`[chat] → messages count: ${messages.length}`);

  try {
    const result = streamText({
      model: google(model),
      messages,
      system: "Ты полезный AI ассистент. Отвечай на языке пользователя.",
      onFinish: ({ usage, finishReason }) => {
        const ms = Date.now() - start;
        console.log(
          `[chat] ✓ done in ${ms}ms | reason: ${finishReason} | tokens: ${usage.promptTokens}→${usage.completionTokens}`
        );
      },
    });
    console.log("After create ", Date.now() - start)
    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        const ms = Date.now() - start;
        console.error(`[chat] ✗ error in ${ms}ms:`, error);
        return error instanceof Error ? error.message : "Ошибка AI";
      },
    });
  } catch (error) {
    const ms = Date.now() - start;
    console.error(`[chat] ✗ exception in ${ms}ms:`, error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
