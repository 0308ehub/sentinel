import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/marketing/brand-logo";

export function MarketingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="force-light flex min-h-screen flex-col bg-white text-[#111]">
      <header className="flex items-center justify-between px-6 pt-8 md:px-16">
        <Link href="/" className="inline-flex">
          <BrandLogo className="h-8" priority />
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Account">
          <Link href="/sign-up" className="glass-pill">
            Get started
          </Link>
          <Link href="/sign-in" className="glass-pill">
            Sign in
          </Link>
          <Link href="/contact" className="glass-pill">
            Talk to us
          </Link>
        </nav>
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
