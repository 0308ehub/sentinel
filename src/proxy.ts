import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/connectors",
  "/learn",
  "/docs(.*)",
  "/any",
  "/contact",
  "/privacy",
  "/terms",
  "/p/(.*)",
  // Landing-page experiments run for signed-out visitors.
  "/api/autopilot/flags",
  "/api/autopilot/events",
]);

// Vercel cron sends the CRON_SECRET bearer; the route checks it again itself.
function isCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return (
    Boolean(secret) &&
    request.nextUrl.pathname === "/api/autopilot/tick" &&
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}

const clerkProxy = clerkMiddleware(
  async (auth, request) => {
    const { userId } = await auth();

    if (userId && (request.nextUrl.pathname.startsWith("/sign-in") || request.nextUrl.pathname.startsWith("/sign-up"))) {
      return NextResponse.redirect(new URL("/ai", request.url));
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
    return NextResponse.next();
  }

  return clerkProxy(request, event);
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
