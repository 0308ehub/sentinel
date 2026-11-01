import { getGoogleStatus } from "@/lib/google/client";
import { currentUserId } from "@/lib/connections/current";

export async function GET(request: Request) {
  if (!await currentUserId()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await getGoogleStatus(new URL(request.url).origin));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check Google.";
    return Response.json({ configured: false, connected: false, error: message }, { status: 500 });
  }
}
