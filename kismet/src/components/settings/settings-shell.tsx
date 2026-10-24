"use client";

import type { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your organization, account, and integrations
        </p>
      </div>
      <div className="flex min-h-0 flex-1 gap-8 px-6 py-5">
        <SettingsNav />
        <ScrollArea className="min-w-0 flex-1">
          <div className="max-w-2xl pb-10 pr-4">
            <div className="mb-5">
              <h2 className="text-base font-semibold">{title}</h2>
              {description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {children}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
