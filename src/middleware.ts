import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Clerk auth integrates here when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set.
  // For local development, the app runs without authentication.
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!clerkKey) {
    return NextResponse.next();
  }

  // When Clerk is configured, wrap with clerkMiddleware in production:
  // import { clerkMiddleware } from "@clerk/nextjs/server";
  // export default clerkMiddleware();
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
