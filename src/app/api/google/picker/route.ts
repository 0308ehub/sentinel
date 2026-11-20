import { googlePickerSession } from "@/lib/google/client";
import { currentAccountId } from "@/lib/connections/current";

export async function GET() {
  if (!await currentAccountId()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await googlePickerSession(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open the Google Picker.";
    return Response.json({ error: message }, { status: 400 });
  }
}
