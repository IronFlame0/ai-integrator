export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

const API = process.env.API_URL || "http://localhost:8000";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { chatId: string } }
) {
  const res = await fetch(`${API}/api/chats/${params.chatId}`, {
    method: "DELETE",
    headers: {
      Authorization: req.headers.get("authorization") || "",
    },
  });
  return new Response(null, { status: res.status });
}
