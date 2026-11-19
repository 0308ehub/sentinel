"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BUILDERS, type Builder } from "@/lib/autopilot/builders";

const LABEL: Record<Builder, string> = {
  kismet: "Kismet",
  cursor: "Cursor",
  "claude-code": "Claude Code",
};

const NOTE: Record<Builder, string> = {
  kismet: "We write the variants from here.",
  cursor: "Your Cursor agent writes the variants.",
  "claude-code": "Your Claude Code agent writes the variants.",
};

const MARK: Record<Builder, string> = {
  kismet: "/kismet-mark.png",
  cursor: "/logos/cursor.svg",
  "claude-code": "/logos/claude.svg",
};

function Mark({ builder }: { builder: Builder }) {
  return <img src={MARK[builder]} alt="" className="h-5 w-5 object-contain" />;
}

/** The account's saved agent, until this menu has loaded it. */
export function useAccountBuilder(): Builder {
  const [builder, setBuilder] = useState<Builder>("kismet");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/autopilot/builder", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ builder?: string }>)
      .then((body) => {
        if (cancelled) return;
        const match = BUILDERS.find((item) => item === body.builder);
        if (match) setBuilder(match);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return builder;
}

/** Who writes the variants for this experiment. */
export function BuilderMenu({ value, onChange }: { value: Builder; onChange: (builder: Builder) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm text-[#374151]">Who writes the variants</p>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className="flex h-10 w-full items-center gap-2 rounded-md border border-[#e1e4e8] bg-white px-2.5 text-left text-sm outline-none hover:bg-[#f8fafc]"
        >
          <Mark builder={value} />
          <span className="min-w-0 flex-1 truncate font-medium text-[#111]">{LABEL[value]}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#6b7280]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 p-1">
          {BUILDERS.map((builder) => (
            <DropdownMenuItem
              key={builder}
              onSelect={() => onChange(builder)}
              className={value === builder ? "bg-muted" : ""}
            >
              <Mark builder={builder} />
              <span className="min-w-0">
                <span className="block font-medium">{LABEL[builder]}</span>
                <span className="block whitespace-normal text-xs text-muted-foreground">{NOTE[builder]}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
