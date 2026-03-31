"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "ai/react";
import { getToken } from "@/lib/auth";
import { fetchMessages, saveMessage, incrementUsage, fetchUsage } from "@/lib/chats";

const MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

type Props = {
  chatId: string;
  onTitleUpdate?: (title: string) => void;
};

export default function Chat({ chatId, onTitleUpdate }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [model, setModel] = useState(MODELS[0].value);
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const titleSetRef = useRef(false);
  const pendingUserMessageRef = useRef<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error } =
    useChat({
      headers: { Authorization: `Bearer ${getToken()}` },
      body: { model, chatId },
      onFinish: async (assistantMessage) => {
        if (pendingUserMessageRef.current) {
          await saveMessage(chatId, {
            role: "user",
            content: pendingUserMessageRef.current,
          });
          pendingUserMessageRef.current = null;
        }

        await saveMessage(chatId, {
          role: "assistant",
          content: assistantMessage.content ?? "",
        });

        if (!titleSetRef.current) {
          const firstUser = messages.find((m) => m.role === "user");
          const title = (firstUser?.content || assistantMessage.content || "New chat")
            .slice(0, 50)
            .trim();
          titleSetRef.current = true;
          onTitleUpdate?.(title);
          await fetch(`/api/chats/${chatId}/title`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${getToken()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ title }),
          });
        }

        const u = await fetchUsage();
        if (u) setUsage(u);
      },
    });

  useEffect(() => {
    titleSetRef.current = false;
    pendingUserMessageRef.current = null;
    setHistoryLoaded(false);

    async function load() {
      const history = await fetchMessages(chatId);
      if (history.length > 0) {
        setMessages(
          history.map((m, i) => ({
            id: `history-${i}`,
            role: m.role as any,
            content: m.content,
          }))
        );
        titleSetRef.current = true;
      }
      setHistoryLoaded(true);
      const u = await fetchUsage();
      if (u) setUsage(u);
    }
    load();
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      await incrementUsage();
      pendingUserMessageRef.current = input;
      handleSubmit(e);
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (!historyLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-0">
        <p className="text-sm text-gray-400">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">

      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 outline-none focus:border-blue-400"
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {usage && (
          <span className="text-xs text-gray-400">
            {usage.remaining} / {usage.limit} запросов сегодня
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto min-h-0 p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-20">
            Начни диалог — напиши что-нибудь
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.content || <span className="animate-pulse text-gray-400">▌</span>}
            </div>
          </div>
        ))}
        {error && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-red-50 text-red-600 border border-red-200">
              {error.message}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="flex shrink-0 gap-2 border-t border-gray-200 bg-white p-3"
      >
        <input
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="Напиши сообщение..."
          value={input}
          onChange={handleInputChange}
          disabled={isLoading || usage?.remaining === 0}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || usage?.remaining === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700"
        >
          {isLoading ? "..." : "→"}
        </button>
      </form>

      {usage?.remaining === 0 && (
        <p className="shrink-0 bg-red-50 px-4 py-2 text-center text-xs text-red-600">
          Дневной лимит исчерпан. Обновится завтра.
        </p>
      )}
    </div>
  );
}
