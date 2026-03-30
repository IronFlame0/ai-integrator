"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/auth";
import Chat from "@/components/chat";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push("/login");
    } else {
      setUser(u);
      setReady(true);
    }
  }, []);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  if (!ready) return null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-2xl p-4">

        {/* Хедер */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800">AI Chat</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              Выйти
            </button>
          </div>
        </div>

        <Chat />
      </div>
    </main>
  );
}
