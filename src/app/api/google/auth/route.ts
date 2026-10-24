import { googleAuthUrl, readGoogleConfig } from "@/lib/google/client";

export async function GET(request: Request) {
  if (!readGoogleConfig()) {
    return Response.redirect(new URL("/settings/connectors/google?error=missing_client", request.url));
  }
  const state = crypto.randomUUID();
  const target = googleAuthUrl(state);
  if (!target) {
    return Response.redirect(new URL("/settings/connectors/google?error=missing_client", request.url));
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      "Set-Cookie": `kismet_google_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
    },
  });
}
