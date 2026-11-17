import type { Metadata } from "next";
import Link from "next/link";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export const metadata: Metadata = {
  title: "Page not found — Kismet",
  description: "That Kismet page is not here.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <MarketingFrame>
      <main className="max-w-xl px-6 py-24 md:px-16">
        <h1 className="text-3xl font-medium tracking-[-0.03em] text-[#141414]">That page is not here</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#3c4250]">The link may be old, or the page may have moved.</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center rounded-full bg-[#0571d3] px-4 text-sm font-medium text-white hover:bg-[#0460b5]"
        >
          Back home
        </Link>
      </main>
    </MarketingFrame>
  );
}
