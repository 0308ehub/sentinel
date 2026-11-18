import { timingSafeEqual } from "node:crypto";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { SIGN_IN_DESTINATION, SIGN_UP_DESTINATION } from "@/lib/auth/destinations";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/connectors",
  "/integrations",
  "/docs(.*)",
  "/contact",
  "/compare(.*)",
  "/privacy",
  "/terms",
  "/p/(.*)",
  // Landing-page experiments run for signed-out visitors.
  "/api/autopilot/flags",
  "/api/autopilot/events",
  "/api/coder/webhook",
  "/api/health",
]);

// Vercel cron sends the CRON_SECRET bearer; the route checks it again itself.
function bearerMatches(header: string | null, secret: string): boolean {
  const got = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && request.nextUrl.pathname === "/api/autopilot/tick" && bearerMatches(request.headers.get("authorization"), secret!);
}

const clerkProxy = clerkMiddleware(
  async (auth, request) => {
    const { userId } = await auth();

    // A Clerk handshake has to finish on the URL it landed on. Redirecting it
    // drops the session, so the homepage looks signed out until Sign in is clicked again.
    const handshake = ["__clerk_handshake", "__clerk_handshake_nonce", "__clerk_db_jwt", "__dev_session", "__clerk_synced"].some(
      (key) => request.nextUrl.searchParams.has(key),
    );
    const path = request.nextUrl.pathname;
    if (userId && !handshake && (path === "/" || path.startsWith("/sign-in") || path.startsWith("/sign-up"))) {
      // Sign-up starts onboarding. Sign-in, and a signed-in visit, open the workspace.
      const next = path.startsWith("/sign-up") ? SIGN_UP_DESTINATION : SIGN_IN_DESTINATION;
      return NextResponse.redirect(new URL(next, request.url));
    }

    if (!isPublicRoute(request) && !isCronRequest(request) && !userId) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Sign in required." }, { status: 401 });
      }

      await auth.protect();
    }
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  }
);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    // Local development can run without Clerk. A production deploy that forgot the key must not serve the app.
    if (process.env.NODE_ENV === "production") {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Sign-in is not configured." }, { status: 503 });
      }
      return new NextResponse("Sign-in is not configured.", { status: 503 });
    }
    return NextResponse.next();
  }

  return clerkProxy(request, event);
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
