import { getToken, fetchWithAuth } from "./auth";

export type Model = {
  id: string;
  label: string;
  provider: string;
  context_limit: number;
};

export type Chat = {
  id: string;
  title: string;
  context_tokens: number;
  document_id: string | null;
  document_name: string | null;
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

export async function fetchModels(): Promise<Model[]> {
  const res = await fetch("/api/models");
  if (!res.ok) return [];
  return res.json();
}

export async function fetchChats(): Promise<Chat[]> {
  const res = await fetchWithAuth("/api/chats", { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function createChat(): Promise<Chat> {
  const res = await fetchWithAuth("/api/chats", {
    method: "POST",
    headers: authHeaders(),
  });
  return res.json();
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  const res = await fetchWithAuth(`/api/chats/${chatId}/messages`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function saveMessage(chatId: string, message: { role: string; content: string }) {
  await fetchWithAuth(`/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(message),
  });
}

export async function fetchUsage() {
  const res = await fetchWithAuth("/api/usage/today", { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function updateContextTokens(chatId: string, contextTokens: number): Promise<void> {
  const res = await fetchWithAuth(`/api/chats/${chatId}/context`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ context_tokens: contextTokens }),
  });
  if (!res.ok) throw new Error("Не удалось обновить контекст");
}

export async function deleteChat(chatId: string): Promise<void> {
  const res = await fetchWithAuth(`/api/chats/${chatId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Не удалось удалить чат");
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  const res = await fetchWithAuth(`/api/chats/${chatId}/title`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Не удалось переименовать чат");
}

export async function incrementUsage(tokens: number) {
  const res = await fetchWithAuth("/api/usage/increment", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ tokens }),
  });
  if (res.status === 429) {
    const data = await res.json();
    throw new Error(data.detail);
  }
  return res.json();
}
