"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/search/command-palette";
import { ProposeFeatureDialog } from "@/components/propose/propose-feature-dialog";
import { WorkWatcher } from "@/components/layout/work-watcher";
import { ChatDock } from "@/components/ai/chat-dock";
import { MentionWatcher } from "@/components/slack/mention-watcher";

export function AppShell({
  children,
  header = true,
}: {
  children: React.ReactNode;
  header?: boolean;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {header && <Header />}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
      <CommandPalette />
      <ProposeFeatureDialog />
      <WorkWatcher />
      <MentionWatcher />
      <ChatDock />
    </div>
  );
}
