import { NextRequest } from "next/server";

const API = process.env.API_URL || "http://localhost:8000";

function authHeader(req: NextRequest) {
  return req.headers.get("authorization") || "";
}

export async function GET(req: NextRequest) {
  const res = await fetch(`${API}/api/chats`, {
    headers: { Authorization: authHeader(req) },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return Response.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const res = await fetch(`${API}/api/chats`, {
    method: "POST",
    headers: { Authorization: authHeader(req) },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return Response.json(data, { status: res.status });
}
