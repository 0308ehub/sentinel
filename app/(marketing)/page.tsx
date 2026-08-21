import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { SentinelMark } from "@/components/brand/sentinel-logo";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center">
      <SentinelMark size={56} className="text-foreground" />

      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Sentinel</h1>
        <p className="mx-auto max-w-xl text-balance text-lg text-muted-foreground">
          An AI mentor that learns how your child thinks, adapts to how they learn,
          and grows with them over time.
        </p>
      </div>

      <Link className={buttonVariants({ size: "lg" })} href="/sign-up">
        Get started
      </Link>
    </main>
  );
}
