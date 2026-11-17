import "server-only";

import { coderConfigured, coderError } from "@/lib/coder/sessions";
import { currentUserId } from "@/lib/connections/current";

export async function coderUser(): Promise<string | Response> {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!coderConfigured()) return Response.json({ error: "Code mode is not configured." }, { status: 503 });
  return userId;
}

export function coderRouteError(label: string, error: unknown): Response {
  console.error(`[coder] ${label}`, error);
  const safe = coderError(error);
  return Response.json({ error: safe.message }, { status: safe.status });
}

export function messageFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const message = (body as { message?: unknown }).message;
  if (typeof message !== "string") return null;
  const trimmed = message.trim();
  return trimmed.length >= 1 && trimmed.length <= 8000 ? trimmed : null;
}
