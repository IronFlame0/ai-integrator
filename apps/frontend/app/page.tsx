"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/auth";
import { fetchChats, createChat } from "@/lib/chats";
import Chat from "@/components/chat";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);
    loadChats();
  }, []);

  async function loadChats() {
    const list = await fetchChats();
    setChats(list);
    if (list.length > 0) {
      setActiveChatId(list[0].id);
    }
    setReady(true);
  }

  async function handleNewChat() {
    const chat = await createChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-gray-50">

      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">AI Chat</span>
          <button
            onClick={handleNewChat}
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            + Новый
          </button>
        </div>

        {/* Список чатов */}
        <div className="flex-1 overflow-y-auto p-2">
          {chats.length === 0 && (
            <p className="p-2 text-xs text-gray-400">Нет чатов — создай новый</p>
          )}
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm mb-1 truncate transition-colors ${
                activeChatId === chat.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {chat.title}
            </button>
          ))}
        </div>

        {/* Футер sidebar */}
        <div className="border-t border-gray-100 p-3">
          <p className="truncate text-xs text-gray-500 mb-2">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-gray-200 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* Основная область */}
      <main className="flex flex-1 flex-col">
        {activeChatId ? (
          <Chat
            key={activeChatId}
            chatId={activeChatId}
            onTitleUpdate={(title) => {
              setChats((prev) =>
                prev.map((c) => c.id === activeChatId ? { ...c, title } : c)
              );
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-gray-400 mb-4">Нет активного чата</p>
              <button
                onClick={handleNewChat}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Создать чат
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
