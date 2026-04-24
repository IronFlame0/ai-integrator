export const dynamic = "force-dynamic";

import { streamText, tool, type LanguageModelV1 } from "ai";
import { z } from "zod";
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

function findBestDocMatch(query: string, docs: Array<{ id: string; filename: string }>) {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/\.pdf$/i, "").replace(/[_-]/g, " ").split(/\s+/).filter((w) => w.length > 2);

  const queryWords = normalize(query);
  if (queryWords.length === 0) return null;

  let bestScore = 0;
  let bestDoc: { id: string; filename: string } | null = null;

  for (const doc of docs) {
    const nameWords = normalize(doc.filename);
    let score = 0;
    for (const qw of queryWords) {
      if (nameWords.some((nw) => nw.includes(qw) || qw.includes(nw))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDoc = doc;
    }
  }

  return bestScore > 0 ? bestDoc : null;
}

export async function POST(req: Request) {
  const start = Date.now();
  const { messages, model: requestedModel, provider: requestedProvider, documentId, chatId } = await req.json();

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

  const toolInstructions =
    "\n\nИНСТРУМЕНТЫ:\n" +
    "- searchAndAttachDocument: вызывай ТОЛЬКО если пользователь явно просит найти/прикрепить файл И документ ещё не прикреплён к чату. " +
    "После успешного вызова сообщи пользователю что документ добавлен в контекст чата и ты готов отвечать на вопросы по нему. " +
    "НЕ упоминай скачивание, ссылки на файл или загрузку — это добавление к контексту, не файловая операция.\n" +
    "- openQuiz: вызывай когда пользователь просит открыть квиз или тест.";

  let systemPrompt = "Ты полезный AI ассистент. Отвечай на языке пользователя." + toolInstructions;

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
        `Документ "${doc.filename}" уже прикреплён к чату — НЕ вызывай searchAndAttachDocument.\n` +
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

  const safeChatId = typeof chatId === "string" ? chatId : null;

  const chatTools = {
    searchAndAttachDocument: tool({
      description:
        "Поиск PDF документа в библиотеке пользователя по названию и прикрепление его к чату. " +
        "Вызывай когда пользователь просит найти, добавить или прикрепить файл/документ.",
      parameters: z.object({
        query: z.string().describe("Ключевые слова из названия файла для поиска"),
      }),
      execute: async ({ query }) => {
        try {
          const docsRes = await fetch(`${API}/api/documents`, {
            headers: { Authorization: authHeader },
          });
          if (!docsRes.ok) return { found: false, message: "Не удалось получить список документов" };

          const docs = await docsRes.json() as Array<{ id: string; filename: string }>;
          const found = findBestDocMatch(query, docs);

          if (!found) return { found: false, message: `Документ не найден по запросу "${query}"` };

          if (safeChatId) {
            await fetch(`${API}/api/chats/${safeChatId}/document`, {
              method: "PATCH",
              headers: { Authorization: authHeader, "Content-Type": "application/json" },
              body: JSON.stringify({ document_id: found.id }),
            });
          }

          return { found: true, id: found.id, filename: found.filename };
        } catch {
          return { found: false, message: "Ошибка при поиске документа" };
        }
      },
    }),

    openQuiz: tool({
      description:
        "Открыть страницу квиза/теста. Вызывай когда пользователь просит открыть квиз, тест или перейти к заданиям.",
      parameters: z.object({}),
    }),
  };

  console.log(`[chat] → ${provider}/${modelId}, messages: ${messages.length}, doc: ${safeDocumentId ?? "none"}`);

  try {
    let ttft: number | null = null;
    const result = streamText({
      model: resolveModel(provider, modelId),
      messages,
      system: systemPrompt,
      tools: chatTools,
      maxSteps: 3,
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
