import { NextRequest } from "next/server";
const API = process.env.API_URL || "http://localhost:8000";
export async function GET(req: NextRequest) {
  const res = await fetch(`${API}/api/chats/usage/today`, {
    headers: { Authorization: req.headers.get("authorization") || "" },
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
