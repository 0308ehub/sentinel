"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const PRODUCTS = [
  {
    href: "/any",
    name: "any%",
    detail: "The experimentation platform. The shortest valid test, then the next one.",
  },
  {
    href: "/docs/optimize",
    name: "Optimize",
    detail: "An agent that keeps shipping small tests inside guardrails.",
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

export function ProductMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#111] hover:text-[#5c6570]"
      >
        Product
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-3 w-80 rounded-xl border border-[#eceef1] bg-white p-2 shadow-[0_12px_40px_rgba(17,17,17,0.08)]">
          {PRODUCTS.map((product) => (
            <Link
              key={product.href}
              href={product.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 hover:bg-[#f6f7f8]"
            >
              <span className="block text-sm font-medium text-[#111]">{product.name}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-[#5c6570]">{product.detail}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
