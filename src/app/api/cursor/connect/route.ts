import { currentAccountId } from "@/lib/connections/current";
import { connectErrorMessage } from "@/lib/connections/errors";
import { saveConnection } from "@/lib/connections/store";
import { checkCursorKey } from "@/lib/cursor/client";

export async function POST(request: Request) {
  const userId = await currentAccountId();
  if (!userId) return Response.json({ error: "Sign in required." }, { status: 401 });

  try {
    const body = (await request.json()) as { key?: unknown };
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key) throw new Error("API key is required.");

    await checkCursorKey(key);
    await saveConnection(userId, "cursor", { key }, {});
    return Response.json({ connected: true });
  } catch (error) {
    return Response.json({ error: connectErrorMessage(error, "Could not connect Cursor.") }, { status: 400 });
  }
}
