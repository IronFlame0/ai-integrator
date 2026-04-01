export const dynamic = "force-dynamic";

import { streamText } from "ai";
import { google } from "@ai-sdk/google";

const ALLOWED_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
];

export async function POST(req: Request) {
  const start = Date.now();
  const { messages, model: requestedModel } = await req.json();

  const model = ALLOWED_MODELS.includes(requestedModel)
    ? requestedModel
    : (process.env.GEMINI_MODEL || "gemini-2.5-flash");

  console.log(`[chat] → model: ${model}, messages: ${messages.length}`);

  try {
    const result = streamText({
      model: google(model),
      messages,
      system: "Ты полезный AI ассистент. Отвечай на языке пользователя.",
      onFinish: ({ usage, finishReason }) => {
        const ms = Date.now() - start;
        console.log(`[chat] ✓ ${ms}ms | ${finishReason} | ${usage.promptTokens}→${usage.completionTokens} tokens`);
      },
    });

    return result.toDataStreamResponse({
      sendUsage: true,
      getErrorMessage: (error) => {
        console.error(`[chat] ✗ ${Date.now() - start}ms:`, error);
        return error instanceof Error ? error.message : "Ошибка AI";
      },
    });
  } catch (error) {
    console.error(`[chat] ✗ exception:`, error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
