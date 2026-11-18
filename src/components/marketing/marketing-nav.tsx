"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/marketing/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SIGN_IN_DESTINATION } from "@/lib/auth/destinations";
import { useAccount, type Account } from "@/lib/auth/use-account";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/integrations", label: "Integrations" },
  { href: "/compare", label: "Comparisons" },
];

const ACCOUNT_LINKS = [
  { href: "/settings/profile", label: "Account" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
];

function AccountMenu({ account }: { account: Account }) {
  const initial = (account.name || account.email || "?").trim().charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Your account"
        className="hidden h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f4f4f2] text-xs font-medium text-[#111] outline-none ring-[#111] focus-visible:ring-2 sm:inline-flex"
      >
        {account.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Clerk avatar URL, tiny and already optimized.
          <img src={account.imageUrl} alt="" width={32} height={32} className="h-8 w-8 object-cover" />
        ) : (
          initial
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">{account.name || "Your account"}</span>
            <span className="truncate text-xs text-muted-foreground">{account.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={SIGN_IN_DESTINATION}>Open console</Link>
        </DropdownMenuItem>
        {ACCOUNT_LINKS.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void account.signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MarketingNav() {
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // Signed-in visitors stay on the product page; the nav offers the console and their account instead.
  const account = useAccount();

  useEffect(() => {
    if (!mobile) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setMobile(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobile(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [mobile]);

  function close() {
    setMobile(false);
  }

  return (
    <div ref={root}>
      <div className="relative flex h-14 items-center px-5 md:px-6">
        <Link href="/" className="inline-flex shrink-0" aria-label="Kismet" onClick={close}>
          <BrandLogo className="h-[22px]" priority />
        </Link>

        <nav
          className="ml-8 hidden items-center gap-6 md:flex lg:absolute lg:left-1/2 lg:ml-0 lg:-translate-x-1/2"
          aria-label="Primary"
        >
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-[#3a3a38] hover:text-[#111]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {account ? (
            <>
              <Link
                href={SIGN_IN_DESTINATION}
                className="inline-flex h-8 items-center rounded-md bg-[#111] px-3 text-sm font-medium text-white hover:bg-[#2a2a2a]"
              >
                Open console →
              </Link>
              <AccountMenu account={account} />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hidden px-2 text-sm font-medium text-[#2a2a28] hover:text-[#111] sm:inline">
                Sign in
              </Link>
              <Link
                href="/contact"
                className="hidden h-8 items-center rounded-md bg-[#f4f4f2] px-3 text-sm font-medium text-[#111] sm:inline-flex"
              >
                Contact sales
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex h-8 items-center rounded-md bg-[#111] px-3 text-sm font-medium text-white hover:bg-[#2a2a2a]"
              >
                Sign up
              </Link>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#2a2a28] hover:bg-[#eeeee9] md:hidden"
            aria-expanded={mobile}
            aria-label={mobile ? "Close menu" : "Open menu"}
            onClick={() => setMobile((value) => !value)}
          >
            {mobile ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobile && (
        <div className="border-t border-[#eceae4] px-5 py-4 md:hidden">
          <div className="flex flex-col">
            {LINKS.map((item) => (
              <Link key={item.href} href={item.href} onClick={close} className="py-2 text-sm font-medium text-[#2a2a28]">
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {account ? (
              <>
                <Link href={SIGN_IN_DESTINATION} onClick={close} className="py-1.5 text-sm font-medium text-[#111]">
                  Open console
                </Link>
                {ACCOUNT_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} onClick={close} className="py-1.5 text-sm font-medium text-[#111]">
                    {item.label}
                  </Link>
                ))}
                <button type="button" onClick={() => void account.signOut()} className="py-1.5 text-left text-sm font-medium text-[#111]">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/sign-in" onClick={close} className="py-1.5 text-sm font-medium text-[#111]">
                  Sign in
                </Link>
                <Link href="/contact" onClick={close} className="py-1.5 text-sm font-medium text-[#111]">
                  Contact sales
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
