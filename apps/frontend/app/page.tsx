"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/auth";
import { fetchChats, fetchModels, createChat, deleteChat, renameChat, type Model } from "@/lib/chats";
import Chat from "@/components/chat";
import SidebarChatItem from "@/components/sidebar-chat-item";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/login"); return; }
    setUser(u);
    Promise.all([fetchChats(), fetchModels()]).then(([chatList, modelList]) => {
      setChats(chatList);
      setModels(modelList);
      if (chatList.length > 0) setActiveChatId(chatList[0].id);
      setReady(true);
    });
  }, []);

  async function handleNewChat() {
    const chat = await createChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
  }

  async function handleDelete(chatId: string) {
    const prevChats = chats;
    const prevActive = activeChatId;
    const next = chats.filter((c) => c.id !== chatId);
    setChats(next);
    if (activeChatId === chatId) {
      setActiveChatId(next.length > 0 ? next[0].id : null);
    }
    try {
      await deleteChat(chatId);
    } catch {
      setChats(prevChats);
      setActiveChatId(prevActive);
      alert("Не удалось удалить чат. Попробуй ещё раз.");
    }
  }

  async function handleRename(chatId: string, newTitle: string) {
    const prevChats = chats;
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c))
    );
    try {
      await renameChat(chatId, newTitle);
    } catch {
      setChats(prevChats);
      alert("Не удалось переименовать чат. Попробуй ещё раз.");
    }
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-gray-50">

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

        <div className="flex-1 overflow-y-auto p-2">
          {chats.length === 0 && (
            <p className="p-2 text-xs text-gray-400">Нет чатов — создай новый</p>
          )}
          {chats.map((chat) => (
            <SidebarChatItem
              key={chat.id}
              id={chat.id}
              title={chat.title}
              isActive={activeChatId === chat.id}
              onClick={() => setActiveChatId(chat.id)}
              onRename={(newTitle) => handleRename(chat.id, newTitle)}
              onDelete={() => handleDelete(chat.id)}
            />
          ))}
        </div>

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

      <main className="flex flex-1 flex-col">
        {activeChatId ? (
          <Chat
            key={activeChatId}
            chatId={activeChatId}
            models={models}
            initialContextTokens={chats.find((c) => c.id === activeChatId)?.context_tokens ?? 0}
            onTitleUpdate={(title) => {
              setChats((prev) =>
                prev.map((c) => c.id === activeChatId ? { ...c, title } : c)
              );
            }}
            onContextTokensUpdate={(tokens) => {
              setChats((prev) =>
                prev.map((c) => c.id === activeChatId ? { ...c, context_tokens: tokens } : c)
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
