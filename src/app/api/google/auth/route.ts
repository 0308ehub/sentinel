import { currentPersonEmail } from "@/lib/auth/person";
import { googleAuthUrl, readGoogleConfig } from "@/lib/google/client";
import { currentAccountId } from "@/lib/connections/current";

export async function GET(request: Request) {
  if (!await currentAccountId()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = new URL(request.url).origin;
  if (!readGoogleConfig(origin)) {
    return Response.redirect(new URL("/settings/connectors/google?error=missing_client", request.url));
  }
  const state = crypto.randomUUID();
  const target = googleAuthUrl(state, origin, (await currentPersonEmail()) ?? undefined);
  if (!target) {
    return Response.redirect(new URL("/settings/connectors/google?error=missing_client", request.url));
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      "Set-Cookie": `kismet_google_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
    },
  });
}
