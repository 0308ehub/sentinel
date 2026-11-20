"use client";

import { Suspense, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/search/command-palette";
import { ProposeFeatureDialog } from "@/components/propose/propose-feature-dialog";
import { WorkWatcher } from "@/components/layout/work-watcher";
import { AgentRunner } from "@/components/agents/agent-runner";
import { PendingPrd } from "@/components/prd/pending-prd";
import { MentionWatcher } from "@/components/slack/mention-watcher";
import { InboxPresence } from "@/components/inbox/inbox-presence";
import { WorkspaceSync } from "@/components/layout/workspace-sync";
import { LiveSyncProvider } from "@/components/workspace/live-sync";

export function AppShell({
  children,
  header = true,
}: {
  children: React.ReactNode;
  header?: boolean;
}) {
  const pathname = usePathname();
  const embedded = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("kismet_embed") === "1",
    () => false,
  );
  const shell = (
    <div className="flex h-screen overflow-hidden bg-background">
      {!embedded && <Sidebar />}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {header && !embedded && !pathname.startsWith("/ai") && <Header />}
        <PendingPrd />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
      <CommandPalette />
      <ProposeFeatureDialog />
      <WorkWatcher />
      <WorkspaceSync />
      <MentionWatcher />
      <InboxPresence />
      <AgentRunner />
    </div>
  );
  return <Suspense fallback={shell}><LiveSyncProvider>{shell}</LiveSyncProvider></Suspense>;
}
