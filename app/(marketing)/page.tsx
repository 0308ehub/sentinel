import Link from "next/link";
import { SentinelMark } from "@/components/brand/sentinel-logo";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center text-white">
      <SentinelMark size={56} className="text-white" />

      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Sentinel</h1>
        <p className="mx-auto max-w-xl text-balance text-lg text-white/70">
          An AI mentor that learns how your child thinks, adapts to how they learn,
          and grows with them over time.
        </p>
      </div>

      <Link
        href="/sign-up"
        className="inline-flex h-11 items-center justify-center rounded-md bg-white px-8 text-sm font-medium text-[#111827] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]"
      >
        Get started
      </Link>
    </main>
  );
}
