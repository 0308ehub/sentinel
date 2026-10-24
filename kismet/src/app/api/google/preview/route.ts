import { loadGooglePreview } from "@/lib/google/client";

export const maxDuration = 60;

export async function GET() {
  try {
    return Response.json(await loadGooglePreview());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read Google.";
    return Response.json({ error: message }, { status: 502 });
  }
}
