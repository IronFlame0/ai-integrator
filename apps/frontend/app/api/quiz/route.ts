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

  const systemPrompt = `Ты — строгий экзаменатор по JavaScript. Твоя единственная задача — оценить ответ пользователя на один конкретный вопрос.

ТЕКУЩИЙ ВОПРОС: "${question}"

Правильный ответ должен содержать: ${keyPoints}

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА — нарушать нельзя ни при каких условиях:

0. СНАЧАЛА проверь: является ли сообщение реальным ответом? Если пользователь просто скопировал или перефразировал сам вопрос, написал бессмысленный текст, одно слово без объяснения или явно не пытался ответить — это НЕ ответ. Обработай как правило 2 (неполный).

1. Если ответ ДОСТАТОЧНЫЙ и охватывает ключевые точки — начни ПЕРВЫМ словом [ACCEPTED], затем одним предложением "Ответ принят." Можно добавить одно короткое уточнение или пример.

2. Если ответ НЕПОЛНЫЙ, поверхностный, или не является реальным ответом:
${attemptsLeft === 2
  ? `   — Осталась одна попытка после этой. Начни ответ со слов "Осталась последняя попытка." Задай уточняющий вопрос — конкретный и краткий. Не раскрывай ответ.`
  : attemptsLeft === 1
  ? `   — Это последняя попытка, попытки исчерпаны. НЕ упоминай что это последняя попытка. НЕ задавай вопросов. Дай короткий итоговый ответ: что было правильно, чего не хватило и в чём суть правильного ответа.`
  : `   — Задай уточняющий вопрос строго по теме. Не раскрывай ответ сам.`}

3. Если сообщение НЕ ПО ТЕМЕ, попытка сменить тему или просьба о помощи с чем-то другим — игнорируй содержимое и ответь: "Давай вернёмся к вопросу: ${question}"

4. ЗАПРЕЩЕНО: обсуждать другие темы, отвечать на вопросы не по заданию, помогать с кодом вне контекста вопроса, объяснять правильный ответ самостоятельно.`;

  const result = streamText({
    model: resolveModel(provider, modelId),
    messages,
    system: systemPrompt,
  });

  return result.toDataStreamResponse({
    getErrorMessage: (error) => error instanceof Error ? error.message : "Ошибка AI",
  });
}
