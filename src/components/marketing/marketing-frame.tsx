import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export function MarketingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="marketing font-satoshi force-light flex min-h-screen flex-col bg-[#f7f7f4] text-[#111]">
      <header className="sticky top-0 z-20 bg-[#f7f7f4]">
        <MarketingNav />
      </header>
      <div className="flex-1">{children}</div>
      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-6 text-[13px] text-[#6a717c] md:px-16">
        <span>© {new Date().getFullYear()} Kismet™</span>
        <Link href="/privacy" className="hover:text-[#111]">
          Privacy policy
        </Link>
        <Link href="/terms" className="hover:text-[#111]">
          Terms of service
        </Link>
        <Link href="/docs" className="hover:text-[#111]">
          Documentation
        </Link>
        <Link href="/contact" className="hover:text-[#111]">
          Contact us
        </Link>
      </footer>
    </div>
  );
}
