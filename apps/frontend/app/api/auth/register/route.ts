export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch(`${process.env.API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { detail: `Ошибка сервера: ${text || res.status}` };
  }

  return Response.json(data, { status: res.status });
}
