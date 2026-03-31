import { getToken } from "./auth";

export type Chat = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

export async function fetchChats(): Promise<Chat[]> {
  const res = await fetch("/api/chats", { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function createChat(): Promise<Chat> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: authHeaders(),
  });
  return res.json();
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

// Сохраняет ОДНО сообщение
export async function saveMessage(chatId: string, message: { role: string; content: string }) {
  await fetch(`/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(message),
  });
}

export async function fetchUsage() {
  const res = await fetch("/api/usage/today", { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function incrementUsage() {
  const res = await fetch("/api/usage/increment", {
    method: "POST",
    headers: authHeaders(),
  });
  if (res.status === 429) {
    const data = await res.json();
    throw new Error(data.detail);
  }
  return res.json();
}
