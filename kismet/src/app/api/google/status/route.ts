import { getGoogleStatus } from "@/lib/google/client";

export async function GET() {
  try {
    return Response.json(await getGoogleStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check Google.";
    return Response.json({ configured: false, connected: false, error: message }, { status: 500 });
  }
}
