"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "ai/react";
import { getToken, getUser } from "@/lib/auth";
import { fetchModels, type Model } from "@/lib/chats";
import { JS_QUESTIONS } from "@/lib/quiz-questions";
import MarkdownMessage from "@/components/markdown-message";

const FALLBACK_MODELS: Model[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", context_limit: 1_048_576 },
];

const MAX_ATTEMPTS = 4;

type QuizStatus = "answering" | "accepted" | "skipped" | "finished";

export default function QuizPage() {
  const router = useRouter();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [status, setStatus] = useState<QuizStatus>("answering");
  const [models, setModels] = useState<Model[]>(FALLBACK_MODELS);
  const [model, setModel] = useState(FALLBACK_MODELS[0].id);
  const [attempts, setAttempts] = useState(0);
  const [results, setResults] = useState<Array<{ topic: string; question: string; accepted: boolean; attempts: number }>>([]);
  const [summary, setSummary] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentQuestion = JS_QUESTIONS[questionIndex];
  const provider = models.find((m) => m.id === model)?.provider ?? "google";
  const isLastAttempt = attempts === MAX_ATTEMPTS - 1;
  const isExhausted = status === "skipped";

  useEffect(() => {
    if (!getUser()) { router.push("/login"); return; }
    fetchModels().then((list) => {
      if (list.length > 0) {
        setModels(list);
        setModel(list[0].id);
      }
    });
  }, [router]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: "/api/quiz",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: { question: currentQuestion?.question, keyPoints: currentQuestion?.keyPoints, model, provider, attemptsLeft: MAX_ATTEMPTS - attempts },
    onFinish: (message) => {
      if (message.content.trimStart().startsWith("[ACCEPTED]")) {
        setStatus("accepted");
      } else {
        setAttempts((prev) => {
          const next = prev + 1;
          if (next >= MAX_ATTEMPTS) setStatus("skipped");
          return next;
        });
      }
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function pushResult(accepted: boolean, finalAttempts: number) {
    const newResults = [...results, {
      topic: currentQuestion.topic,
      question: currentQuestion.question,
      accepted,
      attempts: finalAttempts,
    }];
    setResults(newResults);
    return newResults;
  }

  async function finishQuiz(finalResults: typeof results) {
    setStatus("finished");
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/quiz/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ results: finalResults, model, provider }),
      });
      const data = await res.json() as { summary: string };
      setSummary(data.summary);
    } catch {
      setSummary("Не удалось получить оценку.");
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleNextQuestion(accepted: boolean) {
    const finalResults = pushResult(accepted, accepted ? attempts + 1 : attempts);
    const nextIndex = questionIndex + 1;
    if (nextIndex >= JS_QUESTIONS.length) {
      finishQuiz(finalResults);
    } else {
      setQuestionIndex(nextIndex);
      setMessages([]);
      setAttempts(0);
      setStatus("answering");
    }
  }

  function cleanContent(content: string) {
    return content.replace(/^\[ACCEPTED\]\s*/i, "");
  }

  const progressPct = ((questionIndex + (status === "accepted" ? 1 : 0)) / JS_QUESTIONS.length) * 100;

  if (status === "finished") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-gray-800">Опрос завершён</h1>
            <p className="text-xs text-gray-400">JavaScript · {JS_QUESTIONS.length} вопроса</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-700 leading-relaxed min-h-[80px]">
            {summaryLoading ? (
              <span className="flex gap-1 pt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </span>
            ) : summary}
          </div>

          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            Вернуться в чат
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">

      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← Назад
          </button>
          <span className="text-sm font-medium text-gray-700">Оценка знаний JavaScript</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 outline-none focus:border-blue-400"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{questionIndex + 1} / {JS_QUESTIONS.length}</span>
        </div>
      </header>

      <div className="h-1 bg-gray-100">
        <div
          className="h-1 bg-blue-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="shrink-0 mx-auto w-full max-w-2xl px-4 pt-5 pb-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
          <div className="text-xs font-medium text-blue-400 mb-1 uppercase tracking-wide">
            Вопрос {questionIndex + 1} · {currentQuestion.topic}
          </div>
          <p className="text-sm font-medium text-gray-800 leading-relaxed">
            {currentQuestion.question}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-2">
        <div className="mx-auto max-w-2xl space-y-3 py-2">
          {messages.length === 0 && (
            <p className="text-center text-xs text-gray-400 pt-4">Напиши свой ответ ниже</p>
          )}
          {messages.map((m) => {
            const isLastAssistant = m.role === "assistant" && m === messages[messages.length - 1];
            const accepted = isLastAssistant && status === "accepted";
            return (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-blue-600 text-white whitespace-pre-wrap"
                      : accepted
                      ? "bg-green-50 text-gray-800 border border-green-200"
                      : "bg-white text-gray-800 border border-gray-200"
                  }`}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : (
                    <MarkdownMessage content={cleanContent(m.content)} />
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl">
          {status === "accepted" ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600 font-medium">✓ Ответ принят</span>
              <button
                onClick={() => handleNextQuestion(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {questionIndex + 1 >= JS_QUESTIONS.length ? "Завершить" : "Следующий вопрос →"}
              </button>
            </div>
          ) : isExhausted ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-500 font-medium">✗ Попытки исчерпаны</span>
              <button
                onClick={() => handleNextQuestion(false)}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                {questionIndex + 1 >= JS_QUESTIONS.length ? "Завершить" : "Следующий вопрос →"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {attempts > 0 && (
                <p className="text-xs text-gray-400">
                  Попытка {attempts + 1} из {MAX_ATTEMPTS}
                </p>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 transition-colors"
                  placeholder="Твой ответ..."
                  value={input}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
                >
                  {isLoading ? "..." : "→"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
