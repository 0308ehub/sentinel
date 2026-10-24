"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { useRouter } from "next/navigation";
import { beginSignup } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }

    setLoading(true);
    beginSignup(name, email);
    router.push("/onboarding/you");
  }

  return (
    <div className="force-light flex min-h-screen flex-col items-center justify-center bg-[#f5f6f8] px-4 py-12 text-[#111]">
      <Link href="/" className="mb-8 inline-flex">
        <BrandLogo className="h-10" priority />
      </Link>

      <div className="w-full max-w-[400px] rounded-lg border border-border bg-white px-8 py-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h1 className="mb-1 text-center text-lg font-semibold text-foreground">
          Create your account
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Start using Kismet for your product team.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoComplete="name"
            className={cn(
              "h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            disabled={loading}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Work email"
            autoComplete="email"
            className={cn(
              "h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            disabled={loading}
          />

          {error && (
            <p className="text-center text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              "mt-1 flex h-11 w-full items-center justify-center rounded-md bg-foreground text-sm font-semibold text-background",
              "transition-colors hover:bg-[#2a2a2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {loading ? "Creating…" : "Continue"}
          </button>
        </form>
      </div>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>Already have an account?</p>
        <Link
          href="/sign-in"
          className="mt-1 inline-block font-medium text-foreground hover:underline"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
