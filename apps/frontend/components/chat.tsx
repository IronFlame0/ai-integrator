"use client";

import { useChat } from "ai/react";

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat();

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Сообщения */}
      <div className="flex h-[500px] flex-col gap-3 overflow-y-auto p-4">
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
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.content || (
                <span className="animate-pulse text-gray-400">▌</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Инпут */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-gray-100 p-3"
      >
        <input
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder="Напиши сообщение..."
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
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
  );
}
