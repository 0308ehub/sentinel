import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { DOC_NAV } from "@/lib/product-docs";
import { cn } from "@/lib/utils";

export function DocsShell({
  current,
  toc,
  children,
}: {
  current: string;
  toc?: { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <div className="marketing force-light min-h-screen bg-white text-[#111]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-6 border-b border-[#eceef1] bg-white px-4 md:px-5">
        <Link href="/" className="inline-flex shrink-0" aria-label="Kismet">
          <BrandLogo className="h-[22px]" priority />
        </Link>
        <Link href="/docs" className="text-sm font-medium text-[#111]">
          Docs
        </Link>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link href="/sign-in" className="px-2 text-sm font-medium text-[#2a2a28] hover:text-[#6d6d68]">
            Sign in
          </Link>
          <Link
            href="/ai"
            className="inline-flex h-8 items-center rounded-full bg-[#111] px-3.5 text-sm font-medium text-white hover:bg-[#2a2a28]"
          >
            Open app
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-[#eceef1] px-3 py-6 lg:block">
          <DocsNav current={current} />
        </aside>

        <div className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
          <details className="mb-8 rounded-lg border border-[#eceef1] px-3 py-2 lg:hidden">
            <summary className="cursor-pointer text-sm font-medium">Contents</summary>
            <div className="pt-3">
              <DocsNav current={current} />
            </div>
          </details>
          <div className="mx-auto max-w-3xl">{children}</div>
        </div>

        {toc && toc.length > 0 && (
          <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 overflow-y-auto px-4 py-10 xl:block">
            <p className="text-sm font-medium text-[#111]">On this page</p>
            <ul className="mt-3 space-y-2">
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="text-[13px] leading-snug text-[#5c6570] hover:text-[#111]">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}

function DocsNav({ current }: { current: string }) {
  return (
    <nav aria-label="Documentation" className="space-y-6">
      {DOC_NAV.map((group) => (
        <div key={group.label}>
          <p className="px-2 text-[13px] font-semibold text-[#111]">{group.label}</p>
          <ul className="mt-1">
            {group.items.map((item) => {
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-[13px] leading-snug",
                      active ? "bg-[#f3f4f6] font-medium text-[#111]" : "text-[#3c4250] hover:bg-[#f7f7f8] hover:text-[#111]",
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocCard({
  href,
  title,
  detail,
  icon,
}: {
  href: string;
  title: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-[#e6e8eb] bg-white p-4 transition hover:border-[#cfd3d8] hover:shadow-[0_8px_24px_rgba(17,17,17,0.04)]"
    >
      <span className="text-[#0571d3]">{icon}</span>
      <span className="mt-3 block text-[15px] font-semibold text-[#111]">{title}</span>
      <span className="mt-1 block text-[13px] leading-relaxed text-[#5c6570]">{detail}</span>
    </Link>
  );
}
