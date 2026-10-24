import { disconnectGoogle } from "@/lib/google/client";

export async function POST() {
  await disconnectGoogle();
  return Response.json({ connected: false });
}
