import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const API = process.env.API_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const res = await fetch(`${API}/api/models`, { cache: "no-store" });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return Response.json(data, { status: res.status });
}
