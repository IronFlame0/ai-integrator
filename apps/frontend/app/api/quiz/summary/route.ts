export const dynamic = "force-dynamic";

import { generateText, type LanguageModelV1 } from "ai";
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

type QuizResult = {
  topic: string;
  question: string;
  accepted: boolean;
  attempts: number;
};

export async function POST(req: Request) {
  const { results, model: requestedModel, provider: requestedProvider } = await req.json() as {
    results: QuizResult[];
    model: string;
    provider: string;
  };

  const provider = typeof requestedProvider === "string" && requestedProvider in ALLOWED
    ? requestedProvider
    : "google";
  const allowedModels = ALLOWED[provider];
  const modelId = allowedModels.includes(requestedModel) ? requestedModel : allowedModels[0];

  const accepted = results.filter((r) => r.accepted).length;
  const total = results.length;

  const resultLines = results.map((r, i) =>
    `${i + 1}. [${r.topic}] — ${r.accepted ? `принят с ${r.attempts} попытки` : `не принят (${r.attempts} попыток)`}`
  ).join("\n");

  const prompt = `Ты — строгий технический интервьюер. Кандидат прошёл опрос по JavaScript.

Результаты:
${resultLines}

Итог: ${accepted} из ${total} вопросов приняты.

Напиши краткую оценку (3–5 предложений). Тон: холодный, профессиональный, без похвал и эмоций. Только факты.
ВАЖНО: не додумывай и не предполагай знания кандидата сверх того что показали результаты. Если вопрос не принят — кандидат его не знает. Не смягчай оценку.`;

  const { text } = await generateText({
    model: resolveModel(provider, modelId),
    prompt,
  });

  return Response.json({ summary: text });
}
