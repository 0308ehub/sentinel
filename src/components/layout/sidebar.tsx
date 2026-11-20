"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Clock, GitBranch, BarChart3, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { BrandLogo } from "@/components/marketing/brand-logo";
import { useWorkspaceSettings } from "@/lib/settings/workspace";
import { CreateExperimentDialog } from "@/components/autopilot/create-experiment-dialog";
import { ExperimentSessions } from "@/components/autopilot/experiment-sessions";
import { useAutopilot } from "@/components/autopilot/use-autopilot";
import type { Builder } from "@/lib/autopilot/builders";
import { getOpenExperiment, setOpenExperiment, subscribeOpenExperiment } from "@/lib/autopilot/open-experiment";
import type { Experiment } from "@/lib/autopilot/types";

type NavItem = { id: string; label: string; href: string; icon: typeof LayoutDashboard };

const NAV: NavItem[] = [
  { id: "experiments", label: "Dashboard", href: "/experiments", icon: LayoutDashboard },
  { id: "timeline", label: "Timeline", href: "/timeline", icon: Clock },
  { id: "graph", label: "Graph", href: "/graph", icon: GitBranch },
  { id: "analytics", label: "Analytics", href: "/analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

function isActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const openId = useSyncExternalStore(subscribeOpenExperiment, getOpenExperiment, () => null);
  const queryClient = useQueryClient();
  const autopilot = useAutopilot();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const hiddenNav = new Set(useWorkspaceSettings().hiddenNav);
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const experiments = autopilot.data?.experiments ?? [];
  const selectedId = pathname.startsWith("/experiments") ? openId : null;

  function openSession(id: string) {
    setOpenExperiment(id);
    router.push(`/experiments?experiment=${id}`);
  }

  async function createExperiment(input: { title: string; change: string; page: string; builder: Builder }) {
    setBusy(true);
    try {
      const response = await fetch("/api/autopilot/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not create the experiment.");
      await queryClient.invalidateQueries({ queryKey: ["autopilot"] });
    } finally {
      setBusy(false);
    }
  }

  async function stopExperiment(experiment: Experiment) {
    await fetch(`/api/autopilot/experiments/${experiment.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    await queryClient.invalidateQueries({ queryKey: ["autopilot"] });
  }

  async function checkSuggestions() {
    setRunning(true);
    try {
      await fetch("/api/autopilot/tick", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["autopilot"] });
    } finally {
      setRunning(false);
    }
  }

  const shown = NAV.filter((item) => item.id === "settings" || !hiddenNav.has(item.id));

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        sidebarCollapsed ? "w-12" : "w-[300px]",
      )}
    >
      <div className={cn("flex items-center gap-0.5 px-1.5", sidebarCollapsed ? "flex-col py-2" : "h-12")}>
        <Link href="/experiments" aria-label="Kismet" title="Experiments" className="grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-sidebar-accent">
          <BrandLogo mark priority className="h-5 w-5" />
        </Link>
        {shown.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-md",
              isActive(item, pathname) ? "bg-accent text-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <item.icon className="h-4 w-4" />
          </Link>
        ))}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent", !sidebarCollapsed && "ml-auto")}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      {!sidebarCollapsed && (
        <ExperimentSessions
          experiments={experiments}
          selectedId={selectedId}
          running={running}
          onOpen={openSession}
          onCreate={() => setCreating(true)}
          onStop={(experiment) => void stopExperiment(experiment)}
          onRun={() => void checkSuggestions()}
        />
      )}
      <CreateExperimentDialog open={creating} busy={busy} onOpenChange={setCreating} onCreate={createExperiment} />
    </aside>
  );
}
