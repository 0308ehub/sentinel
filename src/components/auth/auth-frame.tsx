import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { cn } from "@/lib/utils";

export const authAppearance = {
  variables: {
    colorPrimary: "#111",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-plex)",
  },
  elements: {
    card: "border border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
    headerLogo: "hidden",
  },
};

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className={cn("force-light flex min-h-screen flex-col items-center justify-center", "bg-[#f5f6f8] px-4 py-12 text-[#111]")}>
      <Link href="/" className="mb-8 inline-flex">
        <BrandLogo className="h-10" priority />
      </Link>
      {children}
    </div>
  );
}

export function KeylessAuth({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signingIn = mode === "sign-in";

  return (
    <div className="w-full max-w-[400px] rounded-lg border border-border bg-white px-8 py-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h1 className="text-lg font-semibold text-foreground">
        {signingIn ? "Sign in to Kismet" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Authentication is disabled in this local environment.
      </p>
      <Link
        href={signingIn ? "/ai" : "/onboarding/you"}
        className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background transition-colors hover:bg-[#2a2a2a]"
      >
        Continue
      </Link>
    </div>
  );
}
