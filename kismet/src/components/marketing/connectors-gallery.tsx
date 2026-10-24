"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CONNECTOR_CATEGORIES, CONNECTORS } from "@/lib/connectors/catalog";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Communication",
  "Docs",
  "Project management",
  "Engineering",
  "Design",
  "Meetings",
  "Product analytics",
  "Experiments",
  "Research",
  "Warehouse",
  "Events",
  "Pipelines",
  "Customers",
  "Marketing",
  "Ads",
  "Billing",
];

export function ConnectorsGallery() {
  const [category, setCategory] = useState<string>(CONNECTOR_CATEGORIES[0]);
  const items = useMemo(
    () => CONNECTORS.filter((connector) => connector.category === category),
    [category]
  );

  return (
    <div className="mt-14 flex flex-col gap-10 md:flex-row md:gap-16">
      <nav className="shrink-0 md:w-52" aria-label="Connector categories">
        <ul className="space-y-0.5">
          {CATEGORIES.map((name) => {
            const selected = name === category;
            return (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setCategory(name)}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    "w-full rounded-md px-2 py-1 text-left text-[13.5px] leading-snug",
                    selected ? "font-semibold text-[#111]" : "text-[#6b7280] hover:text-[#111]"
                  )}
                >
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-semibold tracking-tight text-[#111]">{category}</h1>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((connector) => (
            <article key={connector.id} className="min-h-[168px] rounded-lg bg-[#f3f3f1] px-6 pb-6 pt-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                {connector.logo ? (
                  <Image
                    src={connector.logo}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="text-xs font-medium text-[#111]">{connector.name.slice(0, 1)}</span>
                )}
              </div>
              <h2 className="mt-8 text-[15px] font-semibold text-[#111]">{connector.name}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6b7280]">{connector.description}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
