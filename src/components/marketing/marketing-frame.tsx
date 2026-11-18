import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export function MarketingFrame({
  children,
  footer = true,
  tone = "paper",
}: {
  children: ReactNode;
  footer?: boolean;
  tone?: "paper" | "white";
}) {
  const paper = tone === "paper";
  return (
    <div className={`marketing font-satoshi force-light flex min-h-screen flex-col text-[#111] ${paper ? "bg-[#f7f7f4]" : "bg-white"}`}>
      <header className={`sticky top-0 z-20 border-b border-transparent ${paper ? "bg-[#f7f7f4]" : "border-[#eee] bg-white"}`}>
        <MarketingNav />
      </header>
      <div className="flex-1">{children}</div>
      {footer && (
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
      )}
    </div>
  );
}
