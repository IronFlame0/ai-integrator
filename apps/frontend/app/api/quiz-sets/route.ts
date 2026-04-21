export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

const API = process.env.API_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const onlyMine = req.nextUrl.searchParams.get("only_mine") ?? "false";
  const res = await fetch(`${API}/api/quiz/sets?only_mine=${onlyMine}`, {
    headers: { Authorization: req.headers.get("authorization") || "" },
    cache: "no-store",
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${API}/api/quiz/sets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("authorization") || "",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
