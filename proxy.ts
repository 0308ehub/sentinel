import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;

  const { userId } = await auth();
  if (userId) return;

  // API routes answer with 401 rather than an HTML redirect.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Sign in required" } },
      { status: 401 }
    );
  }

  // Pages redirect to sign-in and come back afterwards. auth.protect() renders a
  // 404 here instead, which reads as a broken link.
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("redirect_url", request.nextUrl.pathname);
  return NextResponse.redirect(signIn);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
