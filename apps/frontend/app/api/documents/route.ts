export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

const API = process.env.API_URL || "http://localhost:8000";

function authHeader(req: NextRequest) {
  return req.headers.get("authorization") || "";
}

export async function GET(req: NextRequest) {
  const res = await fetch(`${API}/api/documents`, {
    headers: { Authorization: authHeader(req) },
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return Response.json(data, { status: res.status });
}
