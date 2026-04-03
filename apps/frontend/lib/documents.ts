import { getToken } from "./auth";

export type Document = {
  id: string;
  filename: string;
  file_size: number;
  created_at: string;
};

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

export async function uploadDocument(file: File): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/documents/upload", {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail || "Не удалось загрузить документ");
  }
  return res.json();
}

export async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch("/api/documents", { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function deleteDocument(docId: string): Promise<void> {
  const res = await fetch(`/api/documents/${docId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Не удалось удалить документ");
}

export async function attachDocument(chatId: string, documentId: string | null): Promise<void> {
  const res = await fetch(`/api/chats/${chatId}/document`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId }),
  });
  if (!res.ok) throw new Error("Не удалось прикрепить документ");
}
