export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

const API = process.env.API_URL || "http://localhost:8000";

function authHeader(req: NextRequest) {
  return req.headers.get("authorization") || "";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const res = await fetch(`${API}/api/chats/${params.chatId}/messages`, {
    headers: { Authorization: authHeader(req) },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return Response.json(data, { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const body = await req.json();
  const res = await fetch(`${API}/api/chats/${params.chatId}/messages`, {
    method: "POST",
    headers: {
      Authorization: authHeader(req),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body), // { role, content } — одно сообщение
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return Response.json(data, { status: res.status });
}
