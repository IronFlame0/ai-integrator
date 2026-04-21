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
  history: Array<{ role: string; content: string }>;
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

  const transcriptBlocks = results.map((r, i) => {
    const lines = r.history.map((m) =>
      m.role === "user"
        ? `  Кандидат: ${m.content}`
        : `  Экзаменатор: ${m.content.replace(/^\[ACCEPTED\]\s*/i, "")}`
    ).join("\n");

    const verdict = r.accepted
      ? `✓ Принят (${r.attempts} ${r.attempts === 1 ? "попытка" : "попытки"})`
      : `✗ Не принят`;

    return `--- Вопрос ${i + 1}: ${r.topic} ---\n${r.question}\n${lines}\nИтог: ${verdict}`;
  }).join("\n\n");

  const topics = [...new Set(results.map((r) => r.topic))].join(", ");

  const prompt = `Ты — технический интервьюер. Оцени прохождение собеседования (темы: ${topics}) на основе полного диалога.

${transcriptBlocks}

Итого: ${accepted} из ${total} вопросов приняты.

Напиши оценку кандидата (4–6 предложений):
- Оценивай КАЧЕСТВО ответов по диалогу, а не только факт принятия. Быстрый точный ответ — лучше, чем принятый после подсказок.
- Если кандидат ответил хорошо с первой-второй попытки без подсказок — отметь это.
- Если кандидат не мог ответить без наводок — это слабое место, даже если вопрос принят.
- Отдельно упомяни темы, которые нужно подтянуть.
- Тон: профессиональный, конкретный. Без лишних похвал.`;

  const { text } = await generateText({
    model: resolveModel(provider, modelId),
    prompt,
  });

  return Response.json({ summary: text });
}
