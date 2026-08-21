import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 text-center">
      <Image
        src="/sentinel-logo.png"
        alt="Sentinel"
        width={96}
        height={96}
        priority
        className="dark:invert"
      />

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
