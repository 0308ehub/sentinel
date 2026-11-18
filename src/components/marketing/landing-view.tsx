import Link from "next/link";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { SiteFooter } from "@/components/marketing/site-footer";

export function LandingView() {
  return (
    <MarketingFrame footer={false}>
      <main className="flex-1">
        <section className="mx-auto max-w-[1100px] px-6 pb-24 pt-16 md:px-8 md:pb-32 md:pt-24">
          <h1 className="max-w-[16em] text-[clamp(2.1rem,4.4vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.045em] text-[#111]">
            Context-aware autonomous experimentation for product teams.
          </h1>
          <p className="mt-5 max-w-[38em] text-base leading-relaxed text-[#3f3f3f] md:text-lg">
            Kismet autonomously addresses feature requests, customer complaints, and runs robust experiments to optimize your product.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="inline-flex h-10 items-center rounded-md bg-[#111] px-4 text-sm font-medium text-white hover:bg-[#2a2a2a]">
              Sign up
            </Link>
            <Link href="/contact" className="inline-flex h-10 items-center rounded-md bg-[#f4f4f2] px-4 text-sm font-medium text-[#111]">
              Contact sales
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </MarketingFrame>
  );
}
