"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
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

type Item = { href: string; name: string; detail: string };

const PRODUCTS: Item[] = [
  { href: "/docs/experiment", name: "Experiments", detail: "What to test, the statistic, and when to stop." },
  { href: "/docs/optimize", name: "Guardrails", detail: "The numbers that stop a test before it ships." },
  { href: "/docs/ship", name: "Ship", detail: "The change goes out through Cursor or Claude Code." },
];

const SOLUTIONS: Item[] = [
  { href: "/enterprise", name: "Product teams", detail: "A shared loop for what the company should test next." },
  { href: "/contact", name: "Startups", detail: "Run the loop before you have a warehouse full of history." },
];

const RESOURCES: Item[] = [
  { href: "/blog", name: "Blog", detail: "Notes from the team." },
  { href: "/learn", name: "Learn", detail: "How a test is defined, watched, and stopped." },
  { href: "/connectors", name: "Connectors", detail: "The company context Kismet can read." },
  { href: "/benchmark", name: "Benchmark", detail: "How product models compare." },
];

const COMPARE: Item[] = [
  { href: "/compare/statsig", name: "Statsig", detail: "Experiments, flags, and the warehouse." },
  { href: "/compare/glean", name: "Glean", detail: "Search across the company." },
  { href: "/compare/amplitude", name: "Amplitude", detail: "Product analytics for growth teams." },
  { href: "/compare/posthog", name: "PostHog", detail: "Analytics, flags, and experiments." },
];

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
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
        className="hidden h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f4f4f2] text-xs font-medium text-[#111] outline-none ring-[#0571d3] focus-visible:ring-2 sm:inline-flex"
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
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  // Signed-in visitors stay on the product page; the nav offers the console and their account instead.
  const account = useAccount();

  useEffect(() => {
    if (!open && !mobile) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(null);
        setMobile(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(null);
        setMobile(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, mobile]);

  function close() {
    setOpen(null);
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
          <NavMenu label="Products" items={PRODUCTS} open={open === "products"} onOpen={() => setOpen("products")} onClose={() => setOpen((current) => (current === "products" ? null : current))} onNavigate={close} />
          <NavMenu label="Solutions" items={SOLUTIONS} open={open === "solutions"} onOpen={() => setOpen("solutions")} onClose={() => setOpen((current) => (current === "solutions" ? null : current))} onNavigate={close} />
          <NavMenu
            label="Resources"
            items={RESOURCES}
            groups={[{ label: "Compare", href: "/compare", items: COMPARE }]}
            open={open === "resources"}
            onOpen={() => setOpen("resources")}
            onClose={() => setOpen((current) => (current === "resources" ? null : current))}
            onNavigate={close}
          />
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} onMouseEnter={() => setOpen(null)} className="text-sm font-medium text-[#3a3a38] hover:text-[#0571d3]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {account ? (
            <>
              <Link
                href={SIGN_IN_DESTINATION}
                className="inline-flex h-8 items-center rounded-md bg-[#111] px-3 text-sm font-medium text-white hover:bg-[#0571d3]"
              >
                Open console →
              </Link>
              <AccountMenu account={account} />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hidden px-2 text-sm font-medium text-[#2a2a28] hover:text-[#0571d3] sm:inline">
                Sign in
              </Link>
              <Link
                href="/contact"
                className="hidden h-8 items-center rounded-md bg-[#f4f4f2] px-3 text-sm font-medium text-[#111] hover:text-[#0571d3] sm:inline-flex"
              >
                Contact sales
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex h-8 items-center rounded-md bg-[#111] px-3 text-sm font-medium text-white hover:bg-[#0571d3]"
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
          <MobileGroup label="Products" items={PRODUCTS} onNavigate={close} />
          <MobileGroup label="Solutions" items={SOLUTIONS} onNavigate={close} />
          <div className="mt-3 flex flex-col">
            {LINKS.map((item) => (
              <Link key={item.href} href={item.href} onClick={close} className="py-2 text-sm font-medium text-[#2a2a28]">
                {item.label}
              </Link>
            ))}
          </div>
          <MobileGroup label="Resources" items={RESOURCES} onNavigate={close} />
          <MobileGroup label="Compare" items={[{ href: "/compare", name: "All comparisons", detail: "" }, ...COMPARE]} onNavigate={close} />
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

function NavMenu({
  label,
  items,
  groups = [],
  open,
  onOpen,
  onClose,
  onNavigate,
}: {
  label: string;
  items: Item[];
  groups?: { label: string; href: string; items: Item[] }[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onNavigate: () => void;
}) {
  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) onClose();
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onFocus={onOpen}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#3a3a38] hover:text-[#0571d3]"
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-[#8a8a84]" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 pt-3">
          <div className="w-80 rounded-xl border border-[#eceae4] bg-white p-2 shadow-[0_12px_40px_rgba(17,17,17,0.08)]">
            {items.map((item) => (
              <MenuLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
            {groups.map((group) => (
              <div key={group.label} className="mt-1 border-t border-[#eceae4] pt-1">
                <Link
                  href={group.href}
                  onClick={onNavigate}
                  className="block px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#8a8a84] hover:text-[#141414]"
                >
                  {group.label}
                </Link>
                {group.items.map((item) => (
                  <MenuLink key={item.href} item={item} onNavigate={onNavigate} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ item, onNavigate }: { item: Item; onNavigate: () => void }) {
  return (
    <Link href={item.href} onClick={onNavigate} className="block rounded-lg px-3 py-2.5 hover:bg-[#f6f7f8]">
      <span className="block text-sm font-medium text-[#111]">{item.name}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-[#5c6570]">{item.detail}</span>
    </Link>
  );
}

function MobileGroup({ label, items, onNavigate }: { label: string; items: Item[]; onNavigate: () => void }) {
  return (
    <div className="mt-3">
      <p className="px-0.5 text-xs text-[#8a8a84]">{label}</p>
      <div className="mt-1 flex flex-col">
        {items.map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate} className="py-1.5 text-sm font-medium text-[#2a2a28]">
            {item.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
