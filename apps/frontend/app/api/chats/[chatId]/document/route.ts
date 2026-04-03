export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

const API = process.env.API_URL || "http://localhost:8000";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const body = await req.json();
  const res = await fetch(`${API}/api/chats/${params.chatId}/document`, {
    method: "PATCH",
    headers: {
      Authorization: req.headers.get("authorization") || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return Response.json(data, { status: res.status });
}
