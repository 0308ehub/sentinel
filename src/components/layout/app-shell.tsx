"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/search/command-palette";
import { ProposeFeatureDialog } from "@/components/propose/propose-feature-dialog";
import { WorkWatcher } from "@/components/layout/work-watcher";
import { ChatDock } from "@/components/ai/chat-dock";
import { AgentRunner } from "@/components/agents/agent-runner";
import { PendingPrd } from "@/components/prd/pending-prd";
import { MentionWatcher } from "@/components/slack/mention-watcher";
import { InboxPresence } from "@/components/inbox/inbox-presence";
import { WorkspaceSync } from "@/components/layout/workspace-sync";

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
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {header && <Header />}
        <PendingPrd />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
      <CommandPalette />
      <ProposeFeatureDialog />
      <WorkWatcher />
      <WorkspaceSync />
      <MentionWatcher />
      <InboxPresence />
      <ChatDock />
      <AgentRunner />
    </div>
  );
}
