export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

const API = process.env.API_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const res = await fetch(`${API}/api/documents/${params.docId}/text`, {
    headers: { Authorization: req.headers.get("authorization") || "" },
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return Response.json(data, { status: res.status });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { docId: string } }
) {
  const res = await fetch(`${API}/api/documents/${params.docId}`, {
    method: "DELETE",
    headers: { Authorization: req.headers.get("authorization") || "" },
  });
  if (res.status === 204) return new Response(null, { status: 204 });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { detail: text }; }
  return Response.json(data, { status: res.status });
}
