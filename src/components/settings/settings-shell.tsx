"use client";

import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function SettingsShell({
  title,
  wide,
  children,
}: {
  title: string;
  description?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex min-h-0 flex-1">
        <ScrollArea className="h-full w-52 shrink-0 border-r border-border">
          <div className="px-3 py-4">
            <SettingsNav />
          </div>
        </ScrollArea>
        <ScrollArea className="h-full min-w-0 flex-1">
          <div className={cn("px-6 py-5 pb-16", wide ? "max-w-4xl" : "max-w-2xl")}>{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
