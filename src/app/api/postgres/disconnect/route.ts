import { currentAccountId } from "@/lib/connections/current";
import { disconnectPostgres } from "@/lib/postgres/client";

export async function POST() {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });
  await disconnectPostgres();
  return Response.json({ connected: false });
}
