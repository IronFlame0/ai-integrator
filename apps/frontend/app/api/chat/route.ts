export const dynamic = "force-dynamic";

import { streamText, type LanguageModelV1 } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

const API = process.env.API_URL || "http://localhost:8000";

const ALLOWED: Record<string, string[]> = {
  google:    ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-pro"],
  openai:    ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
};

function resolveModel(provider: string, modelId: string): LanguageModelV1 {
  switch (provider) {
    case "openai":    return openai(modelId);
    case "anthropic": return anthropic(modelId);
    default:          return google(modelId);
  }
}

export async function POST(req: Request) {
  const start = Date.now();
  const { messages, model: requestedModel, provider: requestedProvider, documentId } = await req.json();

  const provider = typeof requestedProvider === "string" && requestedProvider in ALLOWED
    ? requestedProvider
    : "google";

  const allowedModels = ALLOWED[provider];
  const modelId = allowedModels.includes(requestedModel)
    ? requestedModel
    : allowedModels[0];

  const authHeader = (req as Request & { headers: Headers }).headers.get("authorization") || "";

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const safeDocumentId = typeof documentId === "string" && UUID_RE.test(documentId) ? documentId : null;

  let systemPrompt = "Ты полезный AI ассистент. Отвечай на языке пользователя.";

  if (safeDocumentId) {
    try {
      const docRes = await fetch(`${API}/api/documents/${safeDocumentId}/text`, {
        headers: { Authorization: authHeader },
      });
      if (!docRes.ok) {
        return new Response(
          JSON.stringify({ error: "Не удалось загрузить документ. Обнови страницу и попробуй снова." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      const doc = await docRes.json() as { filename: string; content: string };
      systemPrompt =
        `Ты полезный AI ассистент. Отвечай на языке пользователя.\n\n` +
        `Пользователь прикрепил документ "${doc.filename}" для анализа.\n` +
        `ВАЖНО: в документ извлечён только текст — изображения, графики и таблицы-как-картинки не доступны.\n\n` +
        `=== СОДЕРЖИМОЕ ДОКУМЕНТА ===\n${doc.content}\n=== КОНЕЦ ДОКУМЕНТА ===\n\n` +
        `Отвечай на вопросы, опираясь на содержимое документа. ` +
        `Если информации в документе нет — честно сообщи об этом.`;
      console.log(`[chat] document "${doc.filename}" injected (${doc.content.length} chars)`);
    } catch (e) {
      console.error(`[chat] failed to fetch document ${safeDocumentId}:`, e);
      return new Response(
        JSON.stringify({ error: "Не удалось загрузить документ. Проверь подключение и попробуй снова." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  console.log(`[chat] → ${provider}/${modelId}, messages: ${messages.length}, doc: ${safeDocumentId ?? "none"}`);

  try {
    let ttft: number | null = null;
    const result = streamText({
      model: resolveModel(provider, modelId),
      messages,
      system: systemPrompt,
      onChunk: () => {
        if (ttft === null) {
          ttft = Date.now() - start;
          console.log(`[chat] first token: ${ttft}ms`);
        }
      },
      onFinish: ({ usage, finishReason }) => {
        const ms = Date.now() - start;
        console.log(`[chat] ✓ total: ${ms}ms | TTFT: ${ttft}ms | ${finishReason} | ${usage.promptTokens}→${usage.completionTokens} tokens`);
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
