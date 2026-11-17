import { connectPostgres } from "@/lib/postgres/client";

export async function POST(request: Request) {
  let url = "";
  try {
    const body = (await request.json()) as { url?: unknown };
    url = typeof body.url === "string" ? body.url : "";
  } catch {
    return Response.json({ error: "Send the connection URL." }, { status: 400 });
  }
  const status = await connectPostgres(url);
  return Response.json(status, { status: status.connected ? 200 : status.configured ? 400 : 503 });
}
