import { loadGooglePreview } from "@/lib/google/client";
import { currentAccountId } from "@/lib/connections/current";

export const maxDuration = 60;

export async function GET() {
  if (!await currentAccountId()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await loadGooglePreview());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read Google.";
    return Response.json({ error: message }, { status: 502 });
  }
}
