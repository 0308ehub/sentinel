import { exchangeGoogleCode } from "@/lib/google/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/settings/connectors/google", url.origin);
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    destination.searchParams.set("error", oauthError);
    return Response.redirect(destination);
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = readCookie(request.headers.get("cookie"), "kismet_google_state");
  if (!code || !state || !cookie || state !== cookie) {
    destination.searchParams.set("error", "state");
    return Response.redirect(destination);
  }
  try {
    await exchangeGoogleCode(code);
    destination.searchParams.set("connected", "1");
  } catch (error) {
    destination.searchParams.set("error", error instanceof Error ? error.message : "connect_failed");
  }
  const response = Response.redirect(destination);
  response.headers.append("Set-Cookie", "kismet_google_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
  return response;
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
