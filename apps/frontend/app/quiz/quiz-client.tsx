"use client";

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {useChat} from "ai/react";
import {getToken, getUser} from "@/lib/auth";
import {fetchModels, type Model} from "@/lib/chats";
import {JS_QUESTIONS, type OpenQuestion, type MultipleChoiceQuestion} from "@/lib/quiz-questions";
import MarkdownMessage from "@/components/markdown-message";

const FALLBACK_MODELS: Model[] = [
  {id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", context_limit: 1_048_576},
];

const MAX_ATTEMPTS = 4;

type QuizStatus = "answering" | "accepted" | "skipped" | "finished";
type MCResult = "correct" | "wrong" | null;
type Screen = "list" | "quiz";
type QuizQuestion = OpenQuestion | MultipleChoiceQuestion;

type QuizSet = {
  id: number;
  user_id: string;
  name: string;
  question_count: number;
  is_mine: boolean;
  created_at: string;
};

type SetQuestion = {
  id: number;
  user_id: string;
  topic: string;
  question: string;
  type: "open" | "multiple-choice";
  key_points: string | null;
  options: string[] | null;
  correct_index: number | null;
  explanation: string | null;
  is_mine: boolean;
};

function sqToQuiz(q: SetQuestion, idx: number): QuizQuestion {
  if (q.type === "multiple-choice") {
    return {
      type: "multiple-choice",
      id: idx,
      topic: q.topic,
      question: q.question,
      options: q.options ?? [],
      correctIndex: q.correct_index ?? 0,
      explanation: q.explanation ?? "",
    };
  }
  return {type: "open", id: idx, topic: q.topic, question: q.question, keyPoints: q.key_points ?? ""};
}

// ── Add-question sub-form ────────────────────────────────────────────────────
type AddFormProps = {
  setId: number;
  onAdded: (q: SetQuestion) => void;
};

function AddQuestionForm({setId, onAdded}: AddFormProps) {
  const [type, setType] = useState<"open" | "multiple-choice">("open");
  const [topic, setTopic] = useState("");
  const [question, setQuestion] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body =
        type === "open"
          ? {topic, question, type: "open", key_points: keyPoints}
          : {topic, question, type: "multiple-choice", options, correct_index: correctIndex, explanation};
      const res = await fetch(`/api/quiz-sets/${setId}/questions`, {
        method: "POST",
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${getToken()}`},
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const newQ = await res.json() as SetQuestion;
        onAdded(newQ);
        setTopic("");
        setQuestion("");
        setKeyPoints("");
        setOptions(["", "", "", ""]);
        setCorrectIndex(0);
        setExplanation("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 border-t border-gray-100 pt-3 space-y-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            required value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="Тема"
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <select
          value={type} onChange={(e) => setType(e.target.value as "open" | "multiple-choice")}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400"
        >
          <option value="open">Открытый</option>
          <option value="multiple-choice">Выбор</option>
        </select>
      </div>

      <textarea
        required value={question} onChange={(e) => setQuestion(e.target.value)}
        placeholder="Вопрос..." rows={2}
        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400 resize-none"
      />

      {type === "open" ? (
        <textarea
          required value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)}
          placeholder="Ключевые моменты для AI-проверки..." rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400 resize-none"
        />
      ) : (
        <div className="space-y-1.5">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="radio" name={`correct-${setId}`} checked={correctIndex === idx}
                     onChange={() => setCorrectIndex(idx)} className="shrink-0"/>
              <span className="text-xs text-gray-400 font-mono w-4">{String.fromCharCode(65 + idx)}.</span>
              <input
                required value={opt} onChange={(e) => {
                const n = [...options];
                n[idx] = e.target.value;
                setOptions(n);
              }}
                placeholder={`Вариант ${String.fromCharCode(65 + idx)}`}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
              />
            </div>
          ))}
          <input
            value={explanation} onChange={(e) => setExplanation(e.target.value)}
            placeholder="Объяснение правильного ответа"
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          />
        </div>
      )}

      <button
        type="submit" disabled={loading}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Сохранение..." : "Добавить вопрос"}
      </button>
    </form>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function QuizPage() {
  const router = useRouter();

  // shared
  const [screen, setScreen] = useState<Screen>("list");
  const [models, setModels] = useState<Model[]>(FALLBACK_MODELS);
  const [model, setModel] = useState(FALLBACK_MODELS[0].id);

  // list screen
  const [onlyMine, setOnlyMine] = useState(false);
  const [sets, setSets] = useState<QuizSet[]>([]);
  const [setsLoading, setSetsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [setQuestions, setSetQuestions] = useState<Record<number, SetQuestion[]>>({});
  const [loadingQuestions, setLoadingQuestions] = useState<number | null>(null);
  const [newSetName, setNewSetName] = useState("");
  const [showNewSet, setShowNewSet] = useState(false);
  const [creatingSet, setCreatingSet] = useState(false);

  // quiz screen
  const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [status, setStatus] = useState<QuizStatus>("answering");
  const [attempts, setAttempts] = useState(0);
  const [results, setResults] = useState<Array<{
    topic: string; question: string; accepted: boolean; attempts: number;
    history: Array<{ role: string; content: string }>;
  }>>([]);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [mcResult, setMcResult] = useState<MCResult>(null);
  const [mcSelected, setMcSelected] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentQuestion = activeQuestions[questionIndex];
  const isMultipleChoice = currentQuestion?.type === "multiple-choice";
  const provider = models.find((m) => m.id === model)?.provider ?? "google";
  const isLastAttempt = attempts === MAX_ATTEMPTS - 1;
  const isExhausted = status === "skipped";

  useEffect(() => {
    if (!getUser()) {
      router.push("/login");
      return;
    }
    fetchModels().then((list) => {
      if (list.length > 0) {
        setModels(list);
        setModel(list[0].id);
      }
    });
  }, [router]);

  useEffect(() => {
    if (screen !== "list") return;
    setSetsLoading(true);
    fetch(`/api/quiz-sets?only_mine=${onlyMine}`, {
      headers: {Authorization: `Bearer ${getToken()}`},
    })
      .then((r) => r.json())
      .then((data) => setSets(data as QuizSet[]))
      .catch(() => setSets([]))
      .finally(() => setSetsLoading(false));
  }, [screen, onlyMine]);

  async function expandSet(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (setQuestions[id]) return;
    setLoadingQuestions(id);
    try {
      const res = await fetch(`/api/quiz-sets/${id}/questions`, {
        headers: {Authorization: `Bearer ${getToken()}`},
      });
      const data = await res.json() as SetQuestion[];
      setSetQuestions((prev) => ({...prev, [id]: data}));
    } finally {
      setLoadingQuestions(null);
    }
  }

  async function handleCreateSet(e: React.FormEvent) {
    e.preventDefault();
    if (!newSetName.trim()) return;
    setCreatingSet(true);
    try {
      const res = await fetch("/api/quiz-sets", {
        method: "POST",
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${getToken()}`},
        body: JSON.stringify({name: newSetName.trim()}),
      });
      if (res.ok) {
        const newSet = await res.json() as QuizSet;
        setSets((prev) => [newSet, ...prev]);
        setNewSetName("");
        setShowNewSet(false);
        setExpandedId(newSet.id);
        setSetQuestions((prev) => ({...prev, [newSet.id]: []}));
      }
    } finally {
      setCreatingSet(false);
    }
  }

  async function handleDeleteSet(id: number) {
    const res = await fetch(`/api/quiz-sets/${id}`, {
      method: "DELETE",
      headers: {Authorization: `Bearer ${getToken()}`},
    });
    if (res.ok || res.status === 204) {
      setSets((prev) => prev.filter((s) => s.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  }

  async function handleDeleteQuestion(setId: number, qId: number) {
    const res = await fetch(`/api/quiz-questions/${qId}`, {
      method: "DELETE",
      headers: {Authorization: `Bearer ${getToken()}`},
    });
    if (res.ok || res.status === 204) {
      setSetQuestions((prev) => ({...prev, [setId]: prev[setId].filter((q) => q.id !== qId)}));
      setSets((prev) => prev.map((s) => s.id === setId ? {...s, question_count: s.question_count - 1} : s));
    }
  }

  function startQuiz(questions: QuizQuestion[]) {
    if (questions.length === 0) return;
    setActiveQuestions(questions);
    setQuestionIndex(0);
    setStatus("answering");
    setAttempts(0);
    setResults([]);
    setSummary("");
    setMcResult(null);
    setMcSelected(null);
    setScreen("quiz");
  }

  function startSetQuiz(setId: number) {
    const qs = setQuestions[setId];
    if (qs) {
      startQuiz(qs.map((q, i) => sqToQuiz(q, i)));
    } else {
      fetch(`/api/quiz-sets/${setId}/questions`, {
        headers: {Authorization: `Bearer ${getToken()}`},
      })
        .then((r) => r.json())
        .then((data: SetQuestion[]) => {
          setSetQuestions((prev) => ({...prev, [setId]: data}));
          startQuiz(data.map((q, i) => sqToQuiz(q, i)));
        });
    }
  }

  // ── Chat hook ────────────────────────────────────────────────────────────
  const {messages, input, handleInputChange, handleSubmit, isLoading, setMessages} = useChat({
    api: "/api/quiz",
    headers: {Authorization: `Bearer ${getToken()}`},
    body: {
      question: currentQuestion?.question,
      keyPoints: currentQuestion?.type === "open" ? currentQuestion.keyPoints : undefined,
      model, provider,
      attemptsLeft: MAX_ATTEMPTS - attempts,
    },
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
    bottomRef.current?.scrollIntoView({behavior: "smooth"});
  }, [messages]);

  function pushResult(accepted: boolean, finalAttempts: number, history: Array<{ role: string; content: string }>) {
    const r = [...results, {
      topic: currentQuestion.topic,
      question: currentQuestion.question,
      accepted,
      attempts: finalAttempts,
      history
    }];
    setResults(r);
    return r;
  }

  async function finishQuiz(finalResults: typeof results) {
    setStatus("finished");
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/quiz/summary", {
        method: "POST",
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${getToken()}`},
        body: JSON.stringify({results: finalResults, model, provider}),
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
    const finalResults = pushResult(
      accepted, accepted ? attempts + 1 : attempts,
      messages.map((m) => ({role: m.role, content: m.content})),
    );
    const next = questionIndex + 1;
    if (next >= activeQuestions.length) {
      finishQuiz(finalResults);
      return;
    }
    setQuestionIndex(next);
    setMessages([]);
    setAttempts(0);
    setStatus("answering");
    setMcResult(null);
    setMcSelected(null);
  }

  function handleMcSelect(index: number) {
    if (mcResult !== null) return;
    setMcSelected(index);
    const q = currentQuestion as MultipleChoiceQuestion;
    const correct = index === q.correctIndex;
    setMcResult(correct ? "correct" : "wrong");
    setStatus(correct ? "accepted" : "skipped");
  }

  function handleMcNext() {
    const q = currentQuestion as MultipleChoiceQuestion;
    const correct = mcResult === "correct";
    const h = [
      {role: "user", content: q.options[mcSelected!]},
      {role: "assistant", content: correct ? "[ACCEPTED] Верно." : `Неверно. ${q.explanation}`},
    ];
    const finalResults = pushResult(correct, 1, h);
    const next = questionIndex + 1;
    if (next >= activeQuestions.length) {
      finishQuiz(finalResults);
      return;
    }
    setQuestionIndex(next);
    setMessages([]);
    setAttempts(0);
    setStatus("answering");
    setMcResult(null);
    setMcSelected(null);
  }

  function cleanContent(c: string) {
    return c.replace(/^\[ACCEPTED\]\s*/i, "");
  }

  // ── List screen ──────────────────────────────────────────────────────────
  if (screen === "list") {
    return (
      <div className="flex h-screen flex-col bg-gray-50">
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/")}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Назад
            </button>
            <span className="text-sm font-medium text-gray-700">Квиз</span>
          </div>
          <select value={model} onChange={(e) => setModel(e.target.value)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 outline-none focus:border-blue-400">
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto max-w-2xl space-y-6">

            {/* Controls */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)}
                       className="rounded"/>
                Только мои
              </label>
              <button
                onClick={() => setShowNewSet((v) => !v)}
                className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
              >
                {showNewSet ? "Отмена" : "+ Новый набор"}
              </button>
            </div>

            {/* New set form */}
            {showNewSet && (
              <form onSubmit={handleCreateSet} className="flex gap-2">
                <input
                  required autoFocus value={newSetName} onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="Название набора..."
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
                <button type="submit" disabled={creatingSet}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {creatingSet ? "..." : "Создать"}
                </button>
              </form>
            )}

            {/* Default JS set */}
            {!onlyMine && (
              <section>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">По умолчанию</p>
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700 underline underline-offset-2">JavaScript</span>
                      <span
                        className="ml-2 text-xs text-gray-400 underline underline-offset-2">{JS_QUESTIONS.length} вопросов</span>
                    </div>
                    <button
                      onClick={() => startQuiz(JS_QUESTIONS)}
                      className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
                    >
                      ▶ Начать
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* User sets */}
            <section>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                {onlyMine ? "Мои наборы" : "Из базы"}
              </p>

              {setsLoading ? (
                <div className="flex gap-1 py-6 justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]"/>
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]"/>
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]"/>
                </div>
              ) : sets.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  {onlyMine ? "У вас ещё нет наборов" : "Нет наборов в базе"}
                </p>
              ) : (
                <div className="space-y-2">
                  {sets.map((s) => {
                    const expanded = expandedId === s.id;
                    const qs = setQuestions[s.id] ?? [];
                    return (
                      <div key={s.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        {/* Set header */}
                        <div className="flex items-center justify-between px-4 py-3">
                          <button
                            onClick={() => expandSet(s.id)}
                            className="flex items-center gap-2 text-left flex-1 min-w-0"
                          >
                            <span className="text-sm font-medium text-gray-800 truncate">{s.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{s.question_count} вопросов</span>
                            <span className="text-xs text-gray-300 shrink-0">{expanded ? "▲" : "▼"}</span>
                          </button>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <button
                              onClick={() => startSetQuiz(s.id)}
                              disabled={s.question_count === 0}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-30"
                            >
                              ▶
                            </button>
                            {s.is_mine && (
                              <button
                                onClick={() => handleDeleteSet(s.id)}
                                className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded: questions + add form */}
                        {expanded && (
                          <div className="border-t border-gray-100 px-4 pb-4">
                            {loadingQuestions === s.id ? (
                              <div className="flex gap-1 py-3 justify-center">
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:0ms]"/>
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms]"/>
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:300ms]"/>
                              </div>
                            ) : (
                              <>
                                {qs.length === 0 ? (
                                  <p className="text-xs text-gray-400 py-2">Вопросов пока нет</p>
                                ) : (
                                  <ul className="py-2 space-y-1.5">
                                    {qs.map((q) => (
                                      <li key={q.id}
                                          className="flex items-start justify-between gap-2 text-sm text-gray-700">
                                        <span className="flex-1 min-w-0">
                                          <span className="text-xs text-gray-400 mr-1">{q.topic} ·</span>
                                          {q.question}
                                        </span>
                                        {q.is_mine && (
                                          <button
                                            onClick={() => handleDeleteQuestion(s.id, q.id)}
                                            className="text-gray-300 hover:text-red-400 transition-colors shrink-0 text-base leading-none mt-0.5"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {s.is_mine && (
                                  <AddQuestionForm
                                    setId={s.id}
                                    onAdded={(q) => {
                                      setSetQuestions((prev) => ({...prev, [s.id]: [...(prev[s.id] ?? []), q]}));
                                      setSets((prev) => prev.map((x) => x.id === s.id ? {
                                        ...x,
                                        question_count: x.question_count + 1
                                      } : x));
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    );
  }

  // ── Finished screen ──────────────────────────────────────────────────────
  const progressPct = ((questionIndex + (status === "accepted" ? 1 : 0)) / activeQuestions.length) * 100;

  if (status === "finished") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-gray-800">Опрос завершён</h1>
            <p className="text-xs text-gray-400">{activeQuestions.length} вопросов</p>
          </div>
          <div
            className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-700 leading-relaxed min-h-[80px]">
            {summaryLoading ? (
              <span className="flex gap-1 pt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]"/>
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]"/>
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]"/>
              </span>
            ) : summary}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setScreen("list")}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              К списку
            </button>
            <button onClick={() => router.push("/")}
                    className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900">
              Вернуться в чат
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz screen ──────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setScreen("list")}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Назад
          </button>
          <span className="text-sm font-medium text-gray-700">Квиз</span>
        </div>
        <div className="flex items-center gap-3">
          <select value={model} onChange={(e) => setModel(e.target.value)}
                  className="rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 outline-none focus:border-blue-400">
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <span className="text-xs text-gray-400">{questionIndex + 1} / {activeQuestions.length}</span>
        </div>
      </header>

      <div className="h-1 bg-gray-100">
        <div className="h-1 bg-blue-500 transition-all duration-500" style={{width: `${progressPct}%`}}/>
      </div>

      <div className="shrink-0 mx-auto w-full max-w-2xl px-4 pt-5 pb-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
          <div className="text-xs font-medium text-blue-400 mb-1 uppercase tracking-wide">
            Вопрос {questionIndex + 1} · {currentQuestion.topic}
          </div>
          <p className="text-sm font-medium text-gray-800 leading-relaxed">{currentQuestion.question}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-2">
        <div className="mx-auto max-w-2xl space-y-3 py-2">
          {isMultipleChoice ? (
            <div className="space-y-2 pt-2">
              {(currentQuestion as MultipleChoiceQuestion).options.map((option, idx) => {
                const q = currentQuestion as MultipleChoiceQuestion;
                const isSelected = mcSelected === idx;
                const revealed = mcResult !== null;
                const isCorrect = idx === q.correctIndex;
                let style = "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ";
                if (!revealed) style += "border-gray-200 bg-white text-gray-800 hover:border-blue-400 hover:bg-blue-50 cursor-pointer";
                else if (isCorrect) style += "border-green-400 bg-green-50 text-green-800 font-medium";
                else if (isSelected) style += "border-red-300 bg-red-50 text-red-700";
                else style += "border-gray-100 bg-gray-50 text-gray-400";
                return (
                  <button key={idx} className={style} onClick={() => handleMcSelect(idx)} disabled={revealed}>
                    <span className="mr-3 font-mono text-xs opacity-60">{String.fromCharCode(65 + idx)}.</span>
                    {option}
                  </button>
                );
              })}
              {mcResult !== null && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${mcResult === "correct" ? "border-green-200 bg-green-50 text-green-800" : "border-orange-200 bg-orange-50 text-orange-800"}`}>
                  <span className="font-medium mr-1">{mcResult === "correct" ? "Верно!" : "Неверно."}</span>
                  {(currentQuestion as MultipleChoiceQuestion).explanation}
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.length === 0 &&
                <p className="text-center text-xs text-gray-400 pt-4">Напиши свой ответ ниже</p>}
              {messages.map((m) => {
                const isLastAss = m.role === "assistant" && m === messages[messages.length - 1];
                const accepted = isLastAss && status === "accepted";
                return (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-blue-600 text-white whitespace-pre-wrap" : accepted ? "bg-green-50 text-gray-800 border border-green-200" : "bg-white text-gray-800 border border-gray-200"}`}>
                      {m.role === "user" ? m.content : <MarkdownMessage content={cleanContent(m.content)}/>}
                    </div>
                  </div>
                );
              })}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3">
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]"/>
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]"/>
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]"/>
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef}/>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl">
          {isMultipleChoice ? (
            mcResult !== null ? (
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${mcResult === "correct" ? "text-green-600" : "text-red-500"}`}>
                  {mcResult === "correct" ? "✓ Правильно" : "✗ Неверно"}
                </span>
                <button onClick={handleMcNext}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {questionIndex + 1 >= activeQuestions.length ? "Завершить" : "Следующий вопрос →"}
                </button>
              </div>
            ) : <p className="text-xs text-gray-400 text-center">Выбери один из вариантов выше</p>
          ) : status === "accepted" ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600 font-medium">✓ Ответ принят</span>
              <button onClick={() => handleNextQuestion(true)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                {questionIndex + 1 >= activeQuestions.length ? "Завершить" : "Следующий вопрос →"}
              </button>
            </div>
          ) : isExhausted ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-500 font-medium">✗ Попытки исчерпаны</span>
              <button onClick={() => handleNextQuestion(false)}
                      className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
                {questionIndex + 1 >= activeQuestions.length ? "Завершить" : "Следующий вопрос →"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {attempts > 0 && (
                <p className={`text-xs font-medium ${isLastAttempt ? "text-red-400" : "text-gray-400"}`}>
                  {isLastAttempt ? "Последняя попытка!" : `Попытка ${attempts + 1} из ${MAX_ATTEMPTS}`}
                </p>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 transition-colors"
                  placeholder="Твой ответ..." value={input} onChange={handleInputChange}
                  disabled={isLoading} autoFocus
                />
                <button type="submit" disabled={isLoading || !input.trim()}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-blue-700">
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
