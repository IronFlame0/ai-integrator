"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "ai/react";
import { getToken } from "@/lib/auth";
import { fetchMessages, saveMessage, incrementUsage, fetchUsage, updateContextTokens, type Model } from "@/lib/chats";
import { uploadDocument, attachDocument, type Document } from "@/lib/documents";
import MarkdownMessage from "@/components/markdown-message";
import DocumentBadge, { DocumentPicker } from "@/components/document-badge";

const FALLBACK_MODELS: Model[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", context_limit: 1_048_576 },
];

type Props = {
  chatId: string;
  models: Model[];
  initialContextTokens: number;
  initialDocumentId?: string | null;
  initialDocumentName?: string | null;
  onTitleUpdate?: (title: string) => void;
  onContextTokensUpdate?: (tokens: number) => void;
  onDocumentChange?: (docId: string | null, docName: string | null) => void;
};

export default function Chat({
  chatId,
  models,
  initialContextTokens,
  initialDocumentId,
  initialDocumentName,
  onTitleUpdate,
  onContextTokensUpdate,
  onDocumentChange,
}: Props) {
  const activeModels = models.length > 0 ? models : FALLBACK_MODELS;
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [model, setModel] = useState(activeModels[0].id);
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [contextTokens, setContextTokens] = useState(initialContextTokens);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(initialDocumentId ?? null);
  const [documentName, setDocumentName] = useState<string | null>(initialDocumentName ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const titleSetRef = useRef(false);
  const pendingUserMessageRef = useRef<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, error } =
    useChat({
      headers: { Authorization: `Bearer ${getToken()}` },
      body: { model, chatId, documentId },
      onFinish: async (assistantMessage, { usage: tokenUsage }) => {
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

        if (tokenUsage?.promptTokens != null && tokenUsage?.completionTokens != null) {
          const newCtx = tokenUsage.promptTokens + tokenUsage.completionTokens;
          setContextTokens(newCtx);
          onContextTokensUpdate?.(newCtx);
          updateContextTokens(chatId, newCtx).catch(() => {});
        }

        if (tokenUsage?.totalTokens) {
          try {
            const u = await incrementUsage(tokenUsage.totalTokens);
            if (u) setUsage(u);
          } catch {
            const u = await fetchUsage();
            if (u) setUsage(u);
          }
        } else {
          const u = await fetchUsage();
          if (u) setUsage(u);
        }
      },
    });

  useEffect(() => {
    titleSetRef.current = false;
    pendingUserMessageRef.current = null;
    setHistoryLoaded(false);
    setContextTokens(initialContextTokens);
    setDocumentId(initialDocumentId ?? null);
    setDocumentName(initialDocumentName ?? null);
    setUploadError(null);

    async function load() {
      const history = await fetchMessages(chatId);
      if (history.length > 0) {
        setMessages(
          history.map((m, i) => ({
            id: `history-${i}`,
            role: m.role as "user" | "assistant",
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

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const doc: Document = await uploadDocument(file);
      await attachDocument(chatId, doc.id);
      setDocumentId(doc.id);
      setDocumentName(doc.filename);
      onDocumentChange?.(doc.id, doc.filename);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }

  async function handleSelectExisting(doc: Document) {
    setUploadError(null);
    try {
      await attachDocument(chatId, doc.id);
      setDocumentId(doc.id);
      setDocumentName(doc.filename);
      onDocumentChange?.(doc.id, doc.filename);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Не удалось прикрепить документ");
    }
  }

  async function handleDetach() {
    await attachDocument(chatId, null);
    setDocumentId(null);
    setDocumentName(null);
    onDocumentChange?.(null, null);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    if (usage && usage.remaining <= 0) {
      alert("Дневной лимит токенов исчерпан. Обновится завтра.");
      return;
    }
    pendingUserMessageRef.current = input;
    handleSubmit(e);
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

      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2 space-y-2">
        <div className="flex items-center justify-between">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 outline-none focus:border-blue-400"
          >
            {activeModels.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          {usage && (
            <span className="text-xs text-gray-400">
              {(usage.remaining / 1000).toFixed(1)}K / {(usage.limit / 1000).toFixed(0)}K токенов сегодня
            </span>
          )}
        </div>

        {documentName && (
          <DocumentBadge
            filename={documentName}
            uploading={uploading}
            onDetach={handleDetach}
          />
        )}

        {uploadError && (
          <p className="text-xs text-red-500">{uploadError}</p>
        )}

        {contextTokens > 0 && (() => {
          const limit = activeModels.find((m) => m.id === model)?.context_limit ?? 1_048_576;
          const pct = Math.min(100, (contextTokens / limit) * 100);
          const warn = pct >= 80;
          return (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Контекст чата</span>
                <span className={`text-xs ${warn ? "text-orange-500 font-medium" : "text-gray-400"}`}>
                  {contextTokens.toLocaleString("ru")} / {(limit / 1000).toFixed(0)}K токенов
                  {warn && " — скоро переполнение"}
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-gray-100">
                <div
                  className={`h-1 rounded-full transition-all ${warn ? "bg-orange-400" : "bg-blue-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto min-h-0 p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-20">
            {documentName
              ? `Документ "${documentName}" прикреплён — задай вопрос`
              : "Начни диалог — напиши что-нибудь"}
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
                  ? "bg-blue-600 text-white whitespace-pre-wrap"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.role === "user" ? (
                m.content || <span className="animate-pulse text-gray-400">▌</span>
              ) : (
                m.content
                  ? <MarkdownMessage content={m.content} />
                  : <span className="animate-pulse text-gray-400">▌</span>
              )}
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
        {!documentName && (
          <DocumentPicker
            uploading={uploading}
            onUpload={handleUpload}
            onSelect={handleSelectExisting}
          />
        )}
        <input
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          placeholder={documentName ? `Вопрос по "${documentName}"...` : "Напиши сообщение..."}
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
          Дневной лимит токенов исчерпан. Обновится завтра.
        </p>
      )}
    </div>
  );
}
