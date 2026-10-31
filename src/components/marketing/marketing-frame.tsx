import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { ProductMenu } from "@/components/marketing/product-menu";

const NAV = [
  { href: "/connectors", label: "Connectors" },
  { href: "/learn", label: "Learn" },
  { href: "/contact", label: "Contact" },
];

export function MarketingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="marketing force-light flex min-h-screen flex-col bg-white text-[#111]">
      <header className="sticky top-0 z-20 border-b border-[#eceef1] bg-white">
        <div className="flex h-16 items-center px-5 md:px-8">
          <Link href="/" className="inline-flex shrink-0" aria-label="Kismet">
            <BrandLogo className="h-7" priority />
          </Link>
          <nav className="ml-8 hidden items-center gap-6 md:flex" aria-label="Primary">
            <ProductMenu />
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-medium text-[#111] hover:text-[#5c6570]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/sign-in"
              className="inline-flex h-9 items-center rounded-lg border border-[#d7d7d7] bg-white px-3.5 text-sm font-medium text-[#111] hover:bg-[#f6f6f6]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex h-9 items-center rounded-lg bg-[#111] px-3.5 text-sm font-medium text-white hover:bg-[#2a2a2a]"
            >
              Get started
            </Link>
          </div>
        </div>
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
