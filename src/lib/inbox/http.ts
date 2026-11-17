import { currentUserId } from "@/lib/connections/current";
import { InboxError } from "@/lib/inbox/store";

export async function inboxUser(): Promise<string | null> {
  return currentUserId();
}

export function inboxFailure(error: unknown): Response {
  if (error instanceof InboxError) return Response.json({ error: error.message, configured: error.status !== 503 }, { status: error.status });
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const missing = /KISMET_DATABASE_URL|DATABASE_URL/.test(message);
  return Response.json({ error: missing ? "Agents need a database. Set KISMET_DATABASE_URL." : message }, { status: missing ? 503 : 500 });
}

export function tzFrom(request: Request): number | undefined {
  const url = new URL(request.url);
  const raw = url.searchParams.get("tz");
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
