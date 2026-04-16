export const dynamic = "force-dynamic";

import { streamText, type LanguageModelV1 } from "ai";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

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
  const { messages, question, keyPoints, model: requestedModel, provider: requestedProvider, attemptsLeft } = await req.json();

  if (typeof question !== "string" || typeof keyPoints !== "string") {
    return new Response(JSON.stringify({ error: "Invalid quiz payload" }), { status: 400 });
  }
  console.log({attemptsLeft})
  const provider = typeof requestedProvider === "string" && requestedProvider in ALLOWED
    ? requestedProvider
    : "google";
  const allowedModels = ALLOWED[provider];
  const modelId = allowedModels.includes(requestedModel) ? requestedModel : allowedModels[0];

  const lastAttemptInstruction = attemptsLeft === 1
    ? `\n⚠️ Это была последняя попытка. Напиши только: "Попытки исчерпаны. Рекомендуем изучить эту тему подробнее." Больше ничего.`
    : attemptsLeft === 2
    ? `\nНачни ответ словами "Осталась последняя попытка."`
    : ``;

  const systemPrompt = `Ты — строгий экзаменатор по JavaScript. Оцени ответ пользователя на вопрос.

ВОПРОС: "${question}"
КЛЮЧЕВЫЕ ТОЧКИ правильного ответа: ${keyPoints}

АЛГОРИТМ — строго по шагам:

ШАГ 1. Ответ правильный — принять ТОЛЬКО если выполнены ВСЕ условия:
  а) охватывает все ключевые точки
  б) отвечает на ВСЕ части вопроса (если вопрос просит пример — пример обязателен; если просит объяснение — объяснение обязательно)
→ Начни словом [ACCEPTED]. Одним предложением подтверди.${attemptsLeft === 1 ? `\n\n⚠️ Это была последняя попытка. Если ответ неправильный — напиши только: "Попытки исчерпаны. Рекомендуем изучить эту тему подробнее."` : ``}

ШАГ 2. Сообщение — бессмыслица, случайные символы, off-topic, не попытка ответить:
→ Напиши: "Это не похоже на ответ. Попробуй ответить своими словами на вопрос: ${question}"${lastAttemptInstruction}

ШАГ 3. Реальная попытка ответить, но ответ неполный или поверхностный:
→ Задай ОДИН короткий наводящий вопрос строго по теме, помогающий пользователю дополнить ответ. Не раскрывай ответ сам.${lastAttemptInstruction}

ЗАПРЕЩЕНО: раскрывать правильный ответ, задавать больше одного вопроса, менять тему.`;

  const result = streamText({
    model: resolveModel(provider, modelId),
    messages,
    system: systemPrompt,
  });

  return result.toDataStreamResponse({
    getErrorMessage: (error) => error instanceof Error ? error.message : "Ошибка AI",
  });
}
