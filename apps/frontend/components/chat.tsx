"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "ai/react";
import { getToken } from "@/lib/auth";
import { fetchMessages, saveMessage, incrementUsage, fetchUsage, updateContextTokens, type Model } from "@/lib/chats";
import { uploadDocument, attachDocument, type Document } from "@/lib/documents";
import MarkdownMessage from "@/components/markdown-message";
import DocumentBadge, { DocumentPicker } from "@/components/document-badge";
import { VoiceButton } from "@/components/voice-button";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = { stop(): void; start(): void; lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };

const FALLBACK_MODELS: Model[] = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", context_limit: 1_048_576 },
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
  const [msgTimings, setMsgTimings] = useState<Map<string, { ttfb: number; total: number; tokens: number; promptTokens: number }>>(new Map());
  const [expandedTimings, setExpandedTimings] = useState<Set<string>>(new Set());
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listenTick, setListenTick] = useState(0);
  const voiceModeRef = useRef(false);
  const voiceRecRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceTextRef = useRef("");
  const voiceSpokenPosRef = useRef(0);
  const voiceTTSQueueRef = useRef<string[]>([]);
  const voiceTTSActiveRef = useRef(false);
  const voiceWaitDrainRef = useRef(false);
  const titleSetRef = useRef(false);
  const pendingUserMessageRef = useRef<string | null>(null);
  const submitTimeRef = useRef<number>(0);
  const ttfbRef = useRef<number>(0);

  const provider = activeModels.find((m) => m.id === model)?.provider ?? "google";

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, setInput, append, error } =
    useChat({
      headers: { Authorization: `Bearer ${getToken()}` },
      body: { model, provider, chatId, documentId },
      onResponse: () => {
        ttfbRef.current = Date.now();
        const ttfb = ttfbRef.current - submitTimeRef.current;
        console.log(`[chat:client] ← first byte: ${ttfb}ms (network + AI TTFT)`);
      },
      onFinish: async (assistantMessage, { usage: tokenUsage }) => {
        const total = Date.now() - submitTimeRef.current;
        const ttfb = ttfbRef.current - submitTimeRef.current;
        const tokens = tokenUsage?.completionTokens ?? 0;
        const promptTokens = tokenUsage?.promptTokens ?? 0;
        const genMs = total - ttfb;
        const tps = tokens > 0 && genMs > 100 ? Math.round(tokens / (genMs / 1000)) : null;
        console.log(`[chat:client] ✓ total: ${total}ms | TTFB: ${ttfb}ms | gen: ${genMs}ms | ${promptTokens}→${tokens} tokens${tps ? ` | ${tps} t/s` : ""}`);
        setMsgTimings((prev) => new Map(prev).set(assistantMessage.id, { ttfb, total, tokens, promptTokens }));
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

        if (tokenUsage?.promptTokens != null) {
          const newCtx = tokenUsage.promptTokens;
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

        if (voiceModeRef.current) {
          const remaining = stripMarkdown((assistantMessage.content ?? "").slice(voiceSpokenPosRef.current)).trim();
          voiceSpokenPosRef.current = 0;
          if (remaining.length > 1) voiceTTSEnqueue(remaining);
          voiceWaitDrainRef.current = true;
          if (!voiceTTSActiveRef.current && voiceTTSQueueRef.current.length === 0) {
            voiceWaitDrainRef.current = false;
            setListenTick((t) => t + 1);
          }
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

  useEffect(() => {
    if (listenTick > 0 && voiceModeRef.current) startVoiceLoop();
  }, [listenTick]);

  useEffect(() => {
    if (!voiceModeRef.current || !isLoading) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.content) return;

    const newPart = last.content.slice(voiceSpokenPosRef.current);
    if (!newPart) return;

    const sentenceRegex = /[^.!?\n]*[.!?\n]+/g;
    let match;
    let lastEnd = 0;
    while ((match = sentenceRegex.exec(newPart)) !== null) {
      voiceTTSEnqueue(stripMarkdown(match[0]));
      lastEnd = match.index + match[0].length;
    }
    voiceSpokenPosRef.current += lastEnd;
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      voiceModeRef.current = false;
      voiceRecRef.current?.stop();
      window.speechSynthesis.cancel();
    };
  }, []);

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

  function voiceTTSNext() {
    if (voiceTTSQueueRef.current.length === 0) {
      voiceTTSActiveRef.current = false;
      setSpeakingId(null);
      if (voiceWaitDrainRef.current && voiceModeRef.current) {
        voiceWaitDrainRef.current = false;
        setListenTick((t) => t + 1);
      }
      return;
    }
    const text = voiceTTSQueueRef.current.shift()!;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "ru-RU";
    utt.onend = voiceTTSNext;
    utt.onerror = voiceTTSNext;
    voiceTTSActiveRef.current = true;
    window.speechSynthesis.speak(utt);
  }

  function voiceTTSEnqueue(text: string) {
    const cleaned = text.trim();
    if (cleaned.length < 2) return;
    voiceTTSQueueRef.current.push(cleaned);
    if (!voiceTTSActiveRef.current) voiceTTSNext();
  }

  function startVoiceLoop() {
    type SR = new () => SpeechRecognitionInstance;
    const SR =
      (window as typeof window & { SpeechRecognition?: SR }).SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: SR }).webkitSpeechRecognition;
    if (!SR || !voiceModeRef.current) return;

    const rec = new SR();
    voiceRecRef.current = rec;
    rec.lang = "ru-RU";
    rec.continuous = false;
    rec.interimResults = true;
    voiceTextRef.current = "";

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      setInput(final || interim);
      if (final) voiceTextRef.current = final.trim();
    };

    rec.onend = async () => {
      const text = voiceTextRef.current;
      voiceTextRef.current = "";
      if (text && voiceModeRef.current) {
        setInput("");
        await submitVoiceText(text);
      } else if (voiceModeRef.current) {
        setTimeout(() => { if (voiceModeRef.current) startVoiceLoop(); }, 300);
      }
    };

    rec.onerror = () => {
      if (voiceModeRef.current) setTimeout(() => startVoiceLoop(), 500);
    };

    rec.start();
  }

  function toggleVoiceMode() {
    if (voiceModeRef.current) {
      voiceModeRef.current = false;
      setVoiceMode(false);
      voiceRecRef.current?.stop();
      voiceRecRef.current = null;
      window.speechSynthesis.cancel();
      voiceTTSQueueRef.current = [];
      voiceTTSActiveRef.current = false;
      voiceWaitDrainRef.current = false;
      voiceSpokenPosRef.current = 0;
      setSpeakingId(null);
    } else {
      voiceModeRef.current = true;
      setVoiceMode(true);
      startVoiceLoop();
    }
  }

  async function submitVoiceText(text: string) {
    if (!text.trim() || (usage && usage.remaining <= 0)) return;
    voiceSpokenPosRef.current = 0;
    voiceTTSQueueRef.current = [];
    voiceTTSActiveRef.current = false;
    voiceWaitDrainRef.current = false;
    pendingUserMessageRef.current = text;
    submitTimeRef.current = Date.now();
    ttfbRef.current = 0;
    await append({ role: "user", content: text });
  }

  function stripMarkdown(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      .replace(/>\s.+/g, "")
      .replace(/[-*+]\s/g, "")
      .trim();
  }

  function speak(id: string, text: string) {
    window.speechSynthesis.cancel();
    if (speakingId === id) {
      setSpeakingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
    utterance.lang = "ru-RU";
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
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
    submitTimeRef.current = Date.now();
    ttfbRef.current = 0;
    console.log(`[chat:client] → submit`);
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceMode}
              title={voiceMode ? "Выключить голосовой режим" : "Голосовой режим"}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                voiceMode
                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                  : "border border-gray-200 text-gray-500 hover:bg-gray-100"
              }`}
            >
              <span className={voiceMode ? "animate-pulse" : ""}>
                {voiceMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                )}
              </span>
              {voiceMode ? "Голосовой режим" : "Голос"}
            </button>
            {usage && (
              <span className="text-xs text-gray-400">
                {(usage.remaining / 1000).toFixed(1)}K / {(usage.limit / 1000).toFixed(0)}K токенов сегодня
              </span>
            )}
          </div>
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
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            {m.role === "assistant" && msgTimings.has(m.id) && (() => {
              const t = msgTimings.get(m.id)!;
              const genMs = t.total - t.ttfb;
              const tps = t.tokens > 0 && genMs > 100 ? Math.round(t.tokens / (genMs / 1000)) : null;
              const expanded = expandedTimings.has(m.id);
              return (
                <button
                  onClick={() => setExpandedTimings((prev) => {
                    const next = new Set(prev);
                    expanded ? next.delete(m.id) : next.add(m.id);
                    return next;
                  })}
                  className="mb-0.5 px-1 text-[11px] text-gray-300 hover:text-gray-400 transition-colors"
                >
                  {expanded ? (
                    <span className="flex gap-2">
                      <span>⏱ TTFB {t.ttfb}ms</span>
                      <span>· total {(t.total / 1000).toFixed(1)}s</span>
                      {tps && <span>· {tps} t/s</span>}
                      <span>· вход {t.promptTokens.toLocaleString("ru")} tok</span>
                      <span>· выход {t.tokens} tok</span>
                    </span>
                  ) : "⏱"}
                </button>
              );
            })()}
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
            {m.role === "assistant" && m.content && (
              <button
                type="button"
                onClick={() => speak(m.id, m.content)}
                title={speakingId === m.id ? "Остановить" : "Озвучить"}
                className="mt-0.5 px-1 text-[11px] text-gray-300 hover:text-gray-400 transition-colors"
              >
                {speakingId === m.id ? "⏹" : "🔊"}
              </button>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-start">
            <div className="rounded-2xl bg-gray-100 px-4 py-3">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
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
        <VoiceButton
          disabled={isLoading || usage?.remaining === 0}
          onTranscript={(text) => setInput(text)}
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
