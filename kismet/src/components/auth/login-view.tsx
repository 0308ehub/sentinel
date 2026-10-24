"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { destinationAfterSignIn } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

type LoginMode = "email" | "sso" | "org";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginView() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("email");
  const [email, setEmail] = useState("");
  const [orgUrl, setOrgUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function enterApp() {
    setLoading(true);
    router.push(destinationAfterSignIn());
  }

  function handleContinue(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "email") {
      if (!email.trim() || !email.includes("@")) {
        setError("Enter a valid work email.");
        return;
      }
    }

    if (mode === "sso" || mode === "org") {
      if (!orgUrl.trim()) {
        setError(mode === "sso" ? "Enter your organization domain." : "Enter your organization URL.");
        return;
      }
    }

    enterApp();
  }

  return (
    <div className="force-light flex min-h-screen flex-col items-center justify-center bg-[#f5f6f8] px-4 py-12 text-[#111]">
      <Link href="/" className="mb-8 inline-flex">
        <BrandLogo className="h-10" priority />
      </Link>

      <div className="w-full max-w-[400px] rounded-lg border border-border bg-white px-8 py-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={enterApp}
            disabled={loading}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-white text-sm font-medium text-foreground",
              "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            <GoogleIcon className="h-5 w-5 shrink-0" />
            Sign in with Google
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("sso");
              setError("");
            }}
            disabled={loading}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-white text-sm font-medium text-foreground",
              "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              mode === "sso" && "border-foreground bg-muted",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            <UserRound className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            Single Sign-On
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-muted-foreground">Or</span>
          </div>
        </div>

        <form onSubmit={handleContinue} className="flex flex-col gap-4">
          {mode === "email" && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className={cn(
                "h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              disabled={loading}
            />
          )}

          {mode === "sso" && (
            <input
              type="text"
              value={orgUrl}
              onChange={(e) => setOrgUrl(e.target.value)}
              placeholder="company.com"
              autoComplete="organization"
              className={cn(
                "h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              disabled={loading}
              autoFocus
            />
          )}

          {mode === "org" && (
            <input
              type="text"
              value={orgUrl}
              onChange={(e) => setOrgUrl(e.target.value)}
              placeholder="your-company.kismet.app"
              autoComplete="url"
              className={cn(
                "h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              disabled={loading}
              autoFocus
            />
          )}

          {error && (
            <p className="text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "flex h-11 w-full items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background",
              "transition-colors hover:bg-[#2a2a2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {loading ? "Continuing…" : "Continue"}
          </button>
        </form>

        <div className="mt-5 text-center">
          {mode === "org" ? (
            <button
              type="button"
              onClick={() => {
                setMode("email");
                setError("");
              }}
              className="text-sm font-medium text-foreground hover:underline"
            >
              Sign in with email instead
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("org");
                setError("");
              }}
              className="text-sm font-medium text-foreground hover:underline"
            >
              I know my org URL
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>Don&apos;t have an account?</p>
        <Link
          href="/sign-up"
          className="mt-1 inline-block font-medium text-foreground hover:underline"
        >
          Sign up for free.
        </Link>
      </div>
    </div>
  );
}
