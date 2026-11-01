import { disconnectGoogle } from "@/lib/google/client";
import { currentUserId } from "@/lib/connections/current";

export async function POST() {
  if (!await currentUserId()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await disconnectGoogle();
  return Response.json({ connected: false });
}
