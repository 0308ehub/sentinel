"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/marketing/brand-logo";

type Item = { href: string; name: string; detail: string };

const MODELS: Item[] = [
  {
    href: "/benchmark",
    name: "PM Benchmark",
    detail: "How product models compare. We will build this out.",
  },
];

const PRODUCTS: Item[] = [
  {
    href: "/docs/optimize",
    name: "Optimize",
    detail: "An agent that keeps shipping small tests inside guardrails.",
  },
  {
    href: "/docs/experiment",
    name: "Experiment",
    detail: "Design and code experiments, with the stats, the QA, and a write-up.",
  },
  {
    href: "/docs/explore",
    name: "Explore",
    detail: "The product, the numbers, and what people already said.",
  },
  {
    href: "/docs/plan",
    name: "Plan",
    detail: "A feature, a decision, and a hypothesis from the evidence.",
  },
  {
    href: "/docs/ship",
    name: "Ship",
    detail: "The handoff into the tools the team already uses.",
  },
];

const RESOURCES: Item[] = [
  { href: "/blog", name: "Blog", detail: "Notes from the team." },
  { href: "/docs", name: "Docs", detail: "How Kismet works." },
  { href: "/learn", name: "Learn", detail: "What it does, and what it connects to." },
  { href: "/connectors", name: "Connectors", detail: "The tools Kismet can read." },
  { href: "/contact", name: "Contact", detail: "Request a demo or talk to us." },
];

const COMPARE: Item[] = [
  { href: "/compare/statsig", name: "Statsig", detail: "Experiments, flags, and the warehouse." },
  { href: "/compare/glean", name: "Glean", detail: "Search across the company." },
  { href: "/compare/amplitude", name: "Amplitude", detail: "Product analytics for growth teams." },
  { href: "/compare/posthog", name: "PostHog", detail: "Analytics, flags, and experiments." },
];

const LINKS = [
  { href: "/enterprise", label: "Enterprise" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingNav() {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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
          <NavMenu label="Models" items={MODELS} open={open === "models"} onOpen={() => setOpen("models")} onClose={() => setOpen((current) => (current === "models" ? null : current))} onNavigate={close} />
          <NavMenu label="Product" items={PRODUCTS} open={open === "product"} onOpen={() => setOpen("product")} onClose={() => setOpen((current) => (current === "product" ? null : current))} onNavigate={close} />
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} onMouseEnter={() => setOpen(null)} className="text-sm font-medium text-[#2a2a28] hover:text-[#6d6d68]">
              {item.label}
            </Link>
          ))}
          <NavMenu
            label="Resources"
            items={RESOURCES}
            groups={[{ label: "Compare", href: "/compare", items: COMPARE }]}
            open={open === "resources"}
            onOpen={() => setOpen("resources")}
            onClose={() => setOpen((current) => (current === "resources" ? null : current))}
            onNavigate={close}
          />
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link href="/sign-in" className="px-2 text-sm font-medium text-[#2a2a28] hover:text-[#6d6d68]">
            Sign in
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-8 items-center rounded-full border border-[#e4e3de] bg-white px-3.5 text-sm font-medium text-[#2a2a28] hover:bg-[#fbfbfa]"
          >
            Request a demo
          </Link>
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
          <MobileGroup label="Models" items={MODELS} onNavigate={close} />
          <MobileGroup label="Product" items={PRODUCTS} onNavigate={close} />
          <div className="mt-3 flex flex-col">
            {LINKS.map((item) => (
              <Link key={item.href} href={item.href} onClick={close} className="py-2 text-sm font-medium text-[#2a2a28]">
                {item.label}
              </Link>
            ))}
          </div>
          <MobileGroup label="Resources" items={RESOURCES} onNavigate={close} />
          <MobileGroup label="Compare" items={[{ href: "/compare", name: "All comparisons", detail: "" }, ...COMPARE]} onNavigate={close} />
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
        className="text-sm font-medium text-[#2a2a28] hover:text-[#6d6d68]"
      >
        {label}
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
