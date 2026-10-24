import { loadAudience } from "@/lib/analytics/audience";
import type { Audience } from "@/lib/analytics/library";
import { databricksErrorResponse } from "@/lib/databricks/client";

export const maxDuration = 60;

const store = globalThis as unknown as { kismetAudience?: { at: number; body: Audience } };

export async function GET() {
  const cached = store.kismetAudience;
  if (cached && Date.now() - cached.at < 5 * 60_000) return Response.json(cached.body);
  try {
    const body = await loadAudience();
    store.kismetAudience = { at: Date.now(), body };
    return Response.json(body);
  } catch (error) {
    return databricksErrorResponse(error);
  }
}
