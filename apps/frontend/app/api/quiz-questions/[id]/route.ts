export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

const API = process.env.API_URL || "http://localhost:8000";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const res = await fetch(`${API}/api/quiz/questions/${params.id}`, {
    method: "DELETE",
    headers: { Authorization: req.headers.get("authorization") || "" },
  });
  if (res.status === 204) return new Response(null, { status: 204 });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
